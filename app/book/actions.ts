"use server";

import { getSupabase, getSupabaseAdmin } from "@/lib/supabase";
import { Resend } from "resend";
import { headers } from "next/headers";
import { z } from "zod";
import { escapeHtml } from "@/lib/escape";

const resend = new Resend(process.env.RESEND_API_KEY);

const bookingSchema = z.object({
  slotIds: z.array(z.string().uuid()).min(1).max(10),
  services: z
    .array(z.enum(["Photography", "Videography", "Floor plans"]))
    .min(1),
  propertyAddress: z.string().trim().min(1).max(200),
  clientName:      z.string().trim().min(1).max(100),
  clientEmail:     z.string().email().max(200).toLowerCase(),
  notes:           z.string().max(1000).optional(),
  turnstileToken:  z.string(),
});

function formatDate(dateStr: string) {
  return new Date(dateStr + "T12:00:00").toLocaleDateString("en-GB", {
    weekday: "long", day: "numeric", month: "long", year: "numeric",
  });
}

function formatTime(time: string) {
  const [h, m] = time.split(":").map(Number);
  const period = h >= 12 ? "pm" : "am";
  return `${h % 12 || 12}:${String(m).padStart(2, "0")}${period}`;
}

function addHours(time: string, hours: number): string {
  const [h] = time.split(":").map(Number);
  return `${String(h + hours).padStart(2, "0")}:00:00`;
}

export async function submitBooking(data: {
  slotIds: string[];
  services: string[];
  propertyAddress: string;
  clientName: string;
  clientEmail: string;
  notes?: string;
  turnstileToken: string;
}) {
  // ── Input validation (Zod) ─────────────────────────────────────────
  const parsed = bookingSchema.safeParse(data);
  if (!parsed.success) return { error: "Invalid submission." };
  const v = parsed.data;

  // Strip HTML tags from notes so they can't inject into email templates
  const sanitizedNotes = v.notes
    ? v.notes.replace(/<[^>]*>/g, "").trim() || null
    : null;

  // ── Get client IP ───────────────────────────────────────────────────
  const headersList = await headers();
  const ip = headersList.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  const email = v.clientEmail;

  // HTML-escaped variants for use inside email HTML bodies
  const safeAddress = escapeHtml(v.propertyAddress);
  const safeName    = escapeHtml(v.clientName);
  const safeEmail   = escapeHtml(email);
  const safeNotes   = sanitizedNotes ? escapeHtml(sanitizedNotes) : null;
  const safeServices = v.services.map(escapeHtml).join(", ");

  // ── Rate limiting (admin — infrastructure concern, not user data) ───
  const admin = getSupabaseAdmin();
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
  const oneDayAgo  = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

  const [ipCheck, emailCheck] = await Promise.all([
    admin
      .from("rate_limits")
      .select("*", { count: "exact", head: true })
      .eq("key", `ip:${ip}`)
      .gte("created_at", oneHourAgo),
    admin
      .from("rate_limits")
      .select("*", { count: "exact", head: true })
      .eq("key", `email:${email}`)
      .gte("created_at", oneDayAgo),
  ]);

  if ((ipCheck.count ?? 0) >= 3)
    return { error: "Too many requests. Please try again later." };
  if ((emailCheck.count ?? 0) >= 3)
    return { error: "Too many requests from this email. Please try again later." };

  // ── Turnstile verification ──────────────────────────────────────────
  if (process.env.TURNSTILE_SECRET_KEY) {
    if (!v.turnstileToken)
      return { error: "Security check failed. Please try again." };

    const verifyRes = await fetch(
      "https://challenges.cloudflare.com/turnstile/v0/siteverify",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          secret: process.env.TURNSTILE_SECRET_KEY,
          response: v.turnstileToken,
          remoteip: ip,
        }),
      }
    );
    const turnstileResult = await verifyRes.json();
    if (!turnstileResult.success)
      return { error: "Security check failed. Please try again." };
  }

  // Log this attempt — counts toward rate limit even if booking later fails
  await admin.from("rate_limits").insert([
    { key: `ip:${ip}` },
    { key: `email:${email}` },
  ]);

  // ── Reads via anon client (RLS enforced) ───────────────────────────
  const supabase = getSupabase();

  const { data: startSlots, error: fetchError } = await supabase
    .from("slots")
    .select("id, date, start_time, status")
    .in("id", v.slotIds)
    .order("date")
    .order("start_time");

  if (fetchError || !startSlots || startSlots.length === 0)
    return { error: "Could not find the selected slots." };

  if (startSlots.some((s) => s.status !== "open"))
    return { error: "One or more of your selected slots has just been taken. Please review your selection." };

  const allSlotIdsToBlock: string[] = [];

  for (const startSlot of startSlots) {
    const startHour = parseInt(startSlot.start_time.split(":")[0]);
    const endTime = `${String(startHour + 4).padStart(2, "0")}:00:00`;

    const { data: block } = await supabase
      .from("slots")
      .select("id")
      .eq("date", startSlot.date)
      .eq("status", "open")
      .gte("start_time", startSlot.start_time)
      .lt("start_time", endTime)
      .order("start_time");

    if (block) allSlotIdsToBlock.push(...block.map((s) => s.id));
  }

  if (allSlotIdsToBlock.length === 0)
    return { error: "No available slots found." };

  // ── Writes via admin (elevated scope, post-validation only) ────────
  const { data: booking, error: bookingError } = await admin
    .from("bookings")
    .insert({
      slot_id: v.slotIds[0],
      services: v.services,
      property_address: v.propertyAddress,
      client_name: v.clientName,
      client_email: email,
      notes: sanitizedNotes,
      status: "pending",
      booking_type: "half_day",
    })
    .select()
    .single();

  if (bookingError || !booking)
    return { error: "Something went wrong. Please try again." };

  const { error: updateError } = await admin
    .from("slots")
    .update({ status: "pending", booking_id: booking.id })
    .in("id", allSlotIdsToBlock)
    .eq("status", "open");

  if (updateError) {
    await admin.from("bookings").delete().eq("id", booking.id);
    return { error: "Something went wrong. Please try again." };
  }

  // ── Emails ──────────────────────────────────────────────────────────
  const sessions = startSlots.map((s) => ({
    date: formatDate(s.date),
    time: `${formatTime(s.start_time)} – ${formatTime(addHours(s.start_time, 4))}`,
  }));

  const sessionRowsHtml = sessions
    .map(
      (s, i) => `
    ${i > 0 ? '<tr><td colspan="2" style="padding:2px 0;border-top:1px solid #f0f0f0"></td></tr>' : ""}
    <tr>
      <td style="padding:6px 0;color:#666;width:100px;vertical-align:top">${sessions.length > 1 ? `Session ${i + 1}` : "Session"}</td>
      <td style="padding:6px 0">
        <div style="font-weight:500">${s.date}</div>
        <div style="color:#555;font-size:13px">${s.time}</div>
      </td>
    </tr>`
    )
    .join("");

  const sessionListHtml = sessions
    .map((s) => `<li style="padding:4px 0">${s.date} <span style="color:#555">— ${s.time}</span></li>`)
    .join("");

  await resend.emails.send({
    from: "CVZN Studios <bookings@cvznstudios.co.uk>",
    to: "ollie@cvznstudios.co.uk",
    subject: `New booking request — ${data.propertyAddress}`,
    html: `
      <div style="font-family:sans-serif;max-width:520px;color:#111">
        <h2 style="margin:0 0 16px;font-size:18px">New shoot request</h2>
        <table style="width:100%;border-collapse:collapse;font-size:14px">
          ${sessionRowsHtml}
          <tr><td colspan="2" style="padding:8px 0;border-top:1px solid #eee"></td></tr>
          <tr>
            <td style="padding:8px 0;color:#666">Services</td>
            <td style="padding:8px 0;font-weight:500">${safeServices}</td>
          </tr>
          <tr>
            <td style="padding:8px 0;color:#666">Property</td>
            <td style="padding:8px 0;font-weight:500">${safeAddress}</td>
          </tr>
          <tr>
            <td style="padding:8px 0;color:#666">Client</td>
            <td style="padding:8px 0">${safeName}</td>
          </tr>
          <tr>
            <td style="padding:8px 0;color:#666">Email</td>
            <td style="padding:8px 0"><a href="mailto:${safeEmail}" style="color:#111">${safeEmail}</a></td>
          </tr>
          ${safeNotes ? `
          <tr>
            <td style="padding:8px 0;color:#666;vertical-align:top">Notes</td>
            <td style="padding:8px 0;color:#555">${safeNotes}</td>
          </tr>` : ""}
        </table>
        <div style="margin-top:24px">
          <a href="${process.env.NEXT_PUBLIC_SITE_URL}/dashboard"
             style="background:#111;color:#fff;padding:10px 20px;border-radius:8px;text-decoration:none;font-size:13px;font-weight:500">
            Review in dashboard →
          </a>
        </div>
      </div>
    `,
  }).catch((err) => console.error("Email to Ollie failed:", err));

  const sessionPlainText = sessions.map((s) => `  • ${s.date} — ${s.time}`).join("\n");

  await resend.emails.send({
    from: "CVZN Studios <bookings@cvznstudios.co.uk>",
    to: email,
    replyTo: "ollie@cvznstudios.co.uk",
    subject: `Booking request received — ${data.propertyAddress}`,
    text: `Hi ${v.clientName},\n\nWe've received your shoot request and will confirm within 24 hours.\n\n${sessions.length === 1 ? "Session" : "Sessions"}:\n${sessionPlainText}\n\nServices: ${v.services.join(", ")}\nProperty: ${v.propertyAddress}${sanitizedNotes ? `\nNotes: ${sanitizedNotes}` : ""}\n\nQuestions? Reply to this email or contact ollie@cvznstudios.co.uk\n\nCVZN Studios`,
    html: `
      <div style="font-family:sans-serif;max-width:520px;color:#111">
        <h2 style="margin:0 0 8px;font-size:18px">Request received</h2>
        <p style="margin:0 0 20px;color:#555;font-size:14px">
          Hi ${safeName}, we've received your shoot request and will confirm within 24 hours.
        </p>
        <table style="width:100%;border-collapse:collapse;font-size:14px">
          <tr>
            <td style="padding:8px 0;color:#666;width:120px;vertical-align:top">
              ${sessions.length === 1 ? "Session" : "Sessions"}
            </td>
            <td style="padding:8px 0">
              <ul style="margin:0;padding:0;list-style:none">${sessionListHtml}</ul>
            </td>
          </tr>
          <tr>
            <td style="padding:8px 0;color:#666">Services</td>
            <td style="padding:8px 0;font-weight:500">${safeServices}</td>
          </tr>
          <tr>
            <td style="padding:8px 0;color:#666">Property</td>
            <td style="padding:8px 0;font-weight:500">${safeAddress}</td>
          </tr>
          ${safeNotes ? `
          <tr>
            <td style="padding:8px 0;color:#666;vertical-align:top">Notes</td>
            <td style="padding:8px 0;color:#555">${safeNotes}</td>
          </tr>` : ""}
        </table>
        <p style="margin:24px 0 0;font-size:13px;color:#999">
          Questions? Email <a href="mailto:ollie@cvznstudios.co.uk" style="color:#111">ollie@cvznstudios.co.uk</a>
        </p>
      </div>
    `,
  }).catch((err) => console.error("Receipt email to client failed:", err));

  return { success: true };
}

"use server";

import { getSupabaseAdmin } from "@/lib/supabase";
import { Resend } from "resend";
import { revalidatePath } from "next/cache";

const resend = new Resend(process.env.RESEND_API_KEY);

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

// Identifies the start slot of each session from a flat list of hourly slots.
// A new session starts when there's a gap > 1 hour or a new date.
function identifySessionStarts(slots: { date: string; start_time: string }[]) {
  if (slots.length === 0) return [];
  const sorted = [...slots].sort(
    (a, b) => a.date.localeCompare(b.date) || a.start_time.localeCompare(b.start_time)
  );
  const sessions = [sorted[0]];
  for (let i = 1; i < sorted.length; i++) {
    const prev = sorted[i - 1];
    const curr = sorted[i];
    const prevHour = parseInt(prev.start_time.split(":")[0]);
    const currHour = parseInt(curr.start_time.split(":")[0]);
    if (curr.date !== prev.date || currHour > prevHour + 1) {
      sessions.push(curr);
    }
  }
  return sessions;
}

export async function approveBooking(bookingId: string) {
  const admin = getSupabaseAdmin();

  // Fetch booking details before updating (needed for email)
  const { data: booking } = await admin
    .from("bookings")
    .select("client_email, client_name, property_address")
    .eq("id", bookingId)
    .single();

  await admin.from("bookings").update({ status: "confirmed" }).eq("id", bookingId);
  await admin.from("slots").update({ status: "confirmed" }).eq("booking_id", bookingId);

  // Send confirmation email to client
  if (booking) {
    const { data: linkedSlots } = await admin
      .from("slots")
      .select("date, start_time")
      .eq("booking_id", bookingId)
      .order("date")
      .order("start_time");

    const sessions = identifySessionStarts(linkedSlots ?? []);
    const sessionListHtml = sessions
      .map(
        (s) =>
          `<li style="padding:4px 0">${formatDate(s.date)} <span style="color:#555">— ${formatTime(s.start_time)}–${formatTime(addHours(s.start_time, 4))}</span></li>`
      )
      .join("");

    const sessionPlainText = sessions
      .map((s) => `  • ${formatDate(s.date)} — ${formatTime(s.start_time)}–${formatTime(addHours(s.start_time, 4))}`)
      .join("\n");

    await resend.emails.send({
      from: "CVZN Studios <bookings@cvznstudios.co.uk>",
      to: booking.client_email,
      replyTo: "ollie@cvznstudios.co.uk",
      subject: `Booking confirmed — ${booking.property_address}`,
      text: `Hi ${booking.client_name},\n\nYour shoot has been confirmed.\n\n${sessions.length === 1 ? "Session" : "Sessions"}:\n${sessionPlainText}\n\nProperty: ${booking.property_address}\n\nQuestions? Reply to this email or contact ollie@cvznstudios.co.uk\n\nCVZN Studios`,
      html: `
        <div style="font-family:sans-serif;max-width:520px;color:#111">
          <h2 style="margin:0 0 8px;font-size:18px">Your shoot is confirmed ✓</h2>
          <p style="margin:0 0 20px;color:#555;font-size:14px">
            Hi ${booking.client_name}, your shoot has been confirmed. We look forward to seeing you.
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
              <td style="padding:8px 0;color:#666">Property</td>
              <td style="padding:8px 0;font-weight:500">${booking.property_address}</td>
            </tr>
          </table>
          <p style="margin:24px 0 0;font-size:13px;color:#999">
            Questions? Email <a href="mailto:ollie@cvznstudios.co.uk" style="color:#111">ollie@cvznstudios.co.uk</a>
          </p>
        </div>
      `,
    }).catch((err) => console.error("Confirmation email failed:", err));
  }

  revalidatePath("/dashboard");
}

export async function declineBooking(bookingId: string) {
  const admin = getSupabaseAdmin();

  // Fetch booking details before updating (needed for email)
  const { data: booking } = await admin
    .from("bookings")
    .select("client_email, client_name, property_address")
    .eq("id", bookingId)
    .single();

  await admin.from("slots").update({ status: "open", booking_id: null }).eq("booking_id", bookingId);
  await admin.from("bookings").update({ status: "declined" }).eq("id", bookingId);

  // Notify client
  if (booking) {
    await resend.emails.send({
      from: "CVZN Studios <bookings@cvznstudios.co.uk>",
      to: booking.client_email,
      replyTo: "ollie@cvznstudios.co.uk",
      subject: `Your booking request — ${booking.property_address}`,
      text: `Hi ${booking.client_name},\n\nUnfortunately we're unable to confirm your shoot request for ${booking.property_address} at this time.\n\nIf you'd like to rebook or discuss alternative dates, please reply to this email or contact ollie@cvznstudios.co.uk\n\nCVZN Studios`,
      html: `
        <div style="font-family:sans-serif;max-width:520px;color:#111">
          <h2 style="margin:0 0 8px;font-size:18px">Booking request update</h2>
          <p style="margin:0 0 16px;color:#555;font-size:14px">
            Hi ${booking.client_name}, unfortunately we're unable to confirm your shoot request
            for <strong>${booking.property_address}</strong> at this time.
          </p>
          <p style="margin:0;color:#555;font-size:14px">
            If you'd like to rebook or discuss alternative dates, please get in touch at
            <a href="mailto:ollie@cvznstudios.co.uk" style="color:#111">ollie@cvznstudios.co.uk</a>
          </p>
        </div>
      `,
    }).catch((err) => console.error("Decline email failed:", err));
  }

  revalidatePath("/dashboard");
}

export async function addSlots(date: string, times: string[]) {
  const admin = getSupabaseAdmin();
  const rows = times.map((t) => ({ date, start_time: t, status: "open" }));
  const { error } = await admin.from("slots").insert(rows);
  if (error) return { error: error.message };
  revalidatePath("/dashboard");
  return { success: true };
}

export async function deleteSlot(slotId: string) {
  const admin = getSupabaseAdmin();
  await admin.from("slots").delete().eq("id", slotId).eq("status", "open");
  revalidatePath("/dashboard");
}

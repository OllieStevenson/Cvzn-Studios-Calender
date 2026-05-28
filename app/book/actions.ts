"use server";

import { getSupabaseAdmin } from "@/lib/supabase";
import { Resend } from "resend";

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

export async function submitBooking(data: {
  slotId: string;
  propertyAddress: string;
  clientName: string;
  clientEmail: string;
  notes?: string;
}) {
  const admin = getSupabaseAdmin();

  // Atomically claim the slot — only succeeds if it's still open
  const { data: updatedSlot, error: slotError } = await admin
    .from("slots")
    .update({ status: "pending" })
    .eq("id", data.slotId)
    .eq("status", "open")
    .select()
    .single();

  if (slotError || !updatedSlot) {
    return { error: "This slot has just been taken. Please choose another time." };
  }

  const { error: bookingError } = await admin.from("bookings").insert({
    slot_id: data.slotId,
    property_address: data.propertyAddress,
    client_name: data.clientName,
    client_email: data.clientEmail,
    notes: data.notes || null,
    status: "pending",
  });

  if (bookingError) {
    await admin.from("slots").update({ status: "open" }).eq("id", data.slotId);
    return { error: "Something went wrong. Please try again." };
  }

  // Send notification email — don't block the response if it fails
  const dateLabel = formatDate(updatedSlot.date);
  const timeLabel = formatTime(updatedSlot.start_time);

  await resend.emails.send({
    from: "CVZN Studios <bookings@cvznstudios.co.uk>",
    to: "ollie@cvznstudios.co.uk",
    subject: `New booking request — ${data.propertyAddress}`,
    html: `
      <div style="font-family:sans-serif;max-width:520px;color:#111">
        <h2 style="margin:0 0 16px;font-size:18px">New shoot request</h2>
        <table style="width:100%;border-collapse:collapse;font-size:14px">
          <tr>
            <td style="padding:8px 0;color:#666;width:120px">Date</td>
            <td style="padding:8px 0;font-weight:500">${dateLabel}</td>
          </tr>
          <tr>
            <td style="padding:8px 0;color:#666">Time</td>
            <td style="padding:8px 0;font-weight:500">${timeLabel}</td>
          </tr>
          <tr>
            <td style="padding:8px 0;color:#666">Property</td>
            <td style="padding:8px 0;font-weight:500">${data.propertyAddress}</td>
          </tr>
          <tr>
            <td style="padding:8px 0;color:#666">Client</td>
            <td style="padding:8px 0">${data.clientName}</td>
          </tr>
          <tr>
            <td style="padding:8px 0;color:#666">Email</td>
            <td style="padding:8px 0"><a href="mailto:${data.clientEmail}" style="color:#111">${data.clientEmail}</a></td>
          </tr>
          ${data.notes ? `
          <tr>
            <td style="padding:8px 0;color:#666;vertical-align:top">Notes</td>
            <td style="padding:8px 0;color:#555">${data.notes}</td>
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
  }).catch((err) => {
    console.error("Email send failed:", err);
  });

  return { success: true };
}

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
  bookingType: "half_day" | "full_day";
  propertyAddress: string;
  clientName: string;
  clientEmail: string;
  notes?: string;
}) {
  const admin = getSupabaseAdmin();

  // Fetch the selected start slot
  const { data: startSlot, error: fetchError } = await admin
    .from("slots")
    .select("*")
    .eq("id", data.slotId)
    .single();

  if (fetchError || !startSlot || startSlot.status !== "open") {
    return { error: "This slot has just been taken. Please choose another time." };
  }

  // Find all slots to block
  let slotsToBlock: { id: string }[] = [];

  if (data.bookingType === "full_day") {
    const { data: daySlots } = await admin
      .from("slots")
      .select("id")
      .eq("date", startSlot.date)
      .eq("status", "open")
      .order("start_time");
    slotsToBlock = daySlots ?? [];
  } else {
    // Half day: block 4 hours from the selected time
    const startHour = parseInt(startSlot.start_time.split(":")[0]);
    const endTime = `${String(startHour + 4).padStart(2, "0")}:00:00`;
    const { data: halfSlots } = await admin
      .from("slots")
      .select("id")
      .eq("date", startSlot.date)
      .eq("status", "open")
      .gte("start_time", startSlot.start_time)
      .lt("start_time", endTime)
      .order("start_time");
    slotsToBlock = halfSlots ?? [];
  }

  if (slotsToBlock.length === 0) {
    return { error: "No available slots found." };
  }

  // Create the booking
  const { data: booking, error: bookingError } = await admin
    .from("bookings")
    .insert({
      slot_id: data.slotId,
      property_address: data.propertyAddress,
      client_name: data.clientName,
      client_email: data.clientEmail,
      notes: data.notes || null,
      status: "pending",
      booking_type: data.bookingType,
    })
    .select()
    .single();

  if (bookingError || !booking) {
    return { error: "Something went wrong. Please try again." };
  }

  // Mark all affected slots as pending, linked to this booking
  const { error: updateError } = await admin
    .from("slots")
    .update({ status: "pending", booking_id: booking.id })
    .in("id", slotsToBlock.map((s) => s.id))
    .eq("status", "open");

  if (updateError) {
    await admin.from("bookings").delete().eq("id", booking.id);
    return { error: "Something went wrong. Please try again." };
  }

  // Send notification email
  const dateLabel = formatDate(startSlot.date);
  const timeLabel = formatTime(startSlot.start_time);
  const typeLabel = data.bookingType === "full_day" ? "Full day" : "Half day (4 hours)";

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
            <td style="padding:8px 0;color:#666">Duration</td>
            <td style="padding:8px 0;font-weight:500">${typeLabel}</td>
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
  }).catch((err) => { console.error("Email send failed:", err); });

  return { success: true };
}

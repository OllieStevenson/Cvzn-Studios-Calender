"use server";

import { getSupabaseAdmin } from "@/lib/supabase";
import { revalidatePath } from "next/cache";

export async function approveBooking(bookingId: string) {
  const admin = getSupabaseAdmin();
  await admin.from("bookings").update({ status: "confirmed" }).eq("id", bookingId);
  await admin.from("slots").update({ status: "confirmed" }).eq("booking_id", bookingId);
  revalidatePath("/dashboard");
}

export async function declineBooking(bookingId: string) {
  const admin = getSupabaseAdmin();
  await admin.from("slots").update({ status: "open", booking_id: null }).eq("booking_id", bookingId);
  await admin.from("bookings").update({ status: "declined" }).eq("id", bookingId);
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

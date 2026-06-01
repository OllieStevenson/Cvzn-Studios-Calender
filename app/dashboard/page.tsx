import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getSupabaseAdmin } from "@/lib/supabase";
import { verifySessionToken } from "@/lib/session";
import DashboardClient from "./DashboardClient";

export const revalidate = 0;

// Identifies the start slot of each session from a flat list of hourly slots.
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

export default async function DashboardPage() {
  const cookieStore = await cookies();
  const auth = cookieStore.get("dashboard_auth");
  if (!auth?.value || !verifySessionToken(auth.value)) {
    redirect("/dashboard/login");
  }

  const admin = getSupabaseAdmin();

  const { data: bookings } = await admin
    .from("bookings")
    .select("*, slots(*)")
    .order("created_at", { ascending: false });

  // Fetch all linked slots for these bookings to build per-booking session lists
  const bookingIds = (bookings ?? []).map((b) => b.id);

  const { data: linkedSlots } = bookingIds.length > 0
    ? await admin
        .from("slots")
        .select("booking_id, date, start_time")
        .in("booking_id", bookingIds)
        .order("date")
        .order("start_time")
    : { data: [] };

  // Group linked slots by booking_id and identify session starts
  const slotsByBooking = (linkedSlots ?? []).reduce<
    Record<string, { date: string; start_time: string }[]>
  >((acc, slot) => {
    if (!acc[slot.booking_id]) acc[slot.booking_id] = [];
    acc[slot.booking_id].push({ date: slot.date, start_time: slot.start_time });
    return acc;
  }, {});

  const bookingsWithSessions = (bookings ?? []).map((b) => ({
    ...b,
    sessions: identifySessionStarts(slotsByBooking[b.id] ?? []),
  }));

  const { data: openSlots } = await admin
    .from("slots")
    .select("*")
    .eq("status", "open")
    .gte("date", new Date().toISOString().split("T")[0])
    .order("date")
    .order("start_time");

  return (
    <DashboardClient
      bookings={bookingsWithSessions as any}
      openSlots={openSlots ?? []}
    />
  );
}

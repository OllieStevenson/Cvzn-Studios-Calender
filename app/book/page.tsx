import { getSupabase } from "@/lib/supabase";
import BookingClient from "./BookingClient";

export const revalidate = 0;

export default async function BookPage() {
  try {
    const supabase = getSupabase();

    const today = new Date();
    const todayKey = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;

    const threeMonthsOut = new Date(today.getFullYear(), today.getMonth() + 3, today.getDate());
    const maxKey = `${threeMonthsOut.getFullYear()}-${String(threeMonthsOut.getMonth() + 1).padStart(2, "0")}-${String(threeMonthsOut.getDate()).padStart(2, "0")}`;

    const { data: slots, error } = await supabase
      .from("slots")
      .select("id, date, start_time, status")
      .gte("date", todayKey)
      .lte("date", maxKey)
      .in("status", ["open", "pending"])
      .order("date")
      .order("start_time");

    if (error) throw error;

    return <BookingClient initialSlots={slots ?? []} />;
  } catch (err: any) {
    return (
      <div style={{ padding: 40, fontFamily: "monospace" }}>
        <strong>Error loading booking page:</strong>
        <pre>{err?.message ?? String(err)}</pre>
      </div>
    );
  }
}

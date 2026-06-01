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
  } catch (err) {
    // Log full detail server-side; show a generic message to visitors
    console.error("Booking page failed to load:", err);
    return (
      <div className="min-h-screen flex items-center justify-center p-8 text-center">
        <div className="space-y-2">
          <p className="text-white/80 text-sm">We couldn&rsquo;t load the booking page just now.</p>
          <p className="text-white/40 text-xs">
            Please try again shortly, or email{" "}
            <a href="mailto:ollie@cvznstudios.co.uk" className="underline">ollie@cvznstudios.co.uk</a>.
          </p>
        </div>
      </div>
    );
  }
}

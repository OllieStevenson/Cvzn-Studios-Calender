import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getSupabaseAdmin } from "@/lib/supabase";
import DashboardClient from "./DashboardClient";

export const revalidate = 0;

export default async function DashboardPage() {
  // Password gate — check cookie set by /dashboard/login
  const cookieStore = await cookies();
  const auth = cookieStore.get("dashboard_auth");
  if (auth?.value !== process.env.ADMIN_PASSWORD) {
    redirect("/dashboard/login");
  }

  const admin = getSupabaseAdmin();

  // Fetch all bookings newest-first, joined with their slot
  const { data: bookings } = await admin
    .from("bookings")
    .select("*, slots(*)")
    .order("created_at", { ascending: false });

  // Fetch open slots for the availability tab
  const { data: openSlots } = await admin
    .from("slots")
    .select("*")
    .eq("status", "open")
    .gte("date", new Date().toISOString().split("T")[0])
    .order("date")
    .order("start_time");

  return (
    <DashboardClient
      bookings={(bookings ?? []) as any}
      openSlots={openSlots ?? []}
    />
  );
}

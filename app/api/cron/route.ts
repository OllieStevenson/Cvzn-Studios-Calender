import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase";

export async function GET(request: Request) {
  // Verify this is called by Vercel's cron scheduler
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const admin = getSupabaseAdmin();

  // Generate 9am and 3pm slots for the next 3 months
  const slots = [];
  const today = new Date();
  const end = new Date(today.getFullYear(), today.getMonth() + 3, today.getDate());

  for (let d = new Date(today); d <= end; d.setDate(d.getDate() + 1)) {
    const date = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    slots.push({ date, start_time: "09:00:00", status: "open" });
    slots.push({ date, start_time: "15:00:00", status: "open" });
  }

  // Insert in batches, skip any that already exist
  const { error } = await admin
    .from("slots")
    .upsert(slots, { onConflict: "date,start_time", ignoreDuplicates: true });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, slotsGenerated: slots.length });
}

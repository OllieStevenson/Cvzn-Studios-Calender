import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase";

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return NextResponse.json({ error: "Service unavailable" }, { status: 503 });
  }
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const admin = getSupabaseAdmin();
  const times = [
    "09:00:00","10:00:00","11:00:00","12:00:00","13:00:00",
    "14:00:00","15:00:00","16:00:00","17:00:00","18:00:00","19:00:00",
  ];

  const slots = [];
  const today = new Date();
  const end = new Date(today.getFullYear(), today.getMonth() + 3, today.getDate());

  for (let d = new Date(today); d <= end; d.setDate(d.getDate() + 1)) {
    const date = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    for (const t of times) {
      slots.push({ date, start_time: t, status: "open" });
    }
  }

  const { error } = await admin
    .from("slots")
    .upsert(slots, { onConflict: "date,start_time", ignoreDuplicates: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, slotsGenerated: slots.length });
}

import { createClient } from "@supabase/supabase-js";

// Public client — uses anon key, respects RLS. Safe to use anywhere.
export function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}

// Admin client — uses service role key, bypasses RLS.
// ONLY call this in server-side code (Server Actions, Route Handlers).
// Never use inside a client component.
export function getSupabaseAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

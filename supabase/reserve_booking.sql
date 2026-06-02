-- reserve_booking: atomically claim slots + create a booking.
--
-- Closes the TOCTOU race in submitBooking. Previously the action read slot
-- status ("open") and THEN — in separate statements — inserted the booking and
-- flipped slots to "pending". Two clients hitting the same slot could both pass
-- the read and both write. This function does the check-and-claim inside a
-- single transaction with row locks, so concurrent callers serialise and the
-- loser sees the slots already taken.
--
-- Run this in the Supabase SQL editor (Dashboard → SQL Editor → New query).
-- Safe to re-run: CREATE OR REPLACE.
--
-- Called only by the service-role admin client, so RLS is already bypassed;
-- SECURITY INVOKER (the default) is therefore fine. Locking down EXECUTE so the
-- anon/public roles can't call it directly.

create or replace function public.reserve_booking(
  p_slot_ids         uuid[],
  p_services         text[],
  p_property_address text,
  p_client_name      text,
  p_client_email     text,
  p_notes            text
)
returns uuid
language plpgsql
as $$
declare
  v_booking_id uuid;
  v_start      record;
  v_block_ids  uuid[] := '{}';
  v_window_ids uuid[];
begin
  -- 1. Lock every requested start slot. FOR UPDATE blocks until any in-flight
  --    transaction touching these rows commits, then returns the latest state.
  perform 1 from public.slots where id = any(p_slot_ids) for update;

  -- 2. After acquiring the locks, every requested start slot must still be open.
  --    If a concurrent booking just claimed one, the count won't match and we
  --    bail out — the whole transaction rolls back, claiming nothing.
  if (
    select count(*) from public.slots
    where id = any(p_slot_ids) and status = 'open'
  ) <> coalesce(array_length(p_slot_ids, 1), 0) then
    raise exception 'SLOT_TAKEN' using errcode = 'P0001';
  end if;

  -- 3. For each start slot, collect the open slots in its 4-hour half-day window
  --    (same date, start_time within [start, start+4h)). Lock them too so a
  --    parallel booking on an overlapping window can't grab them mid-flight.
  for v_start in
    select id, date, start_time from public.slots where id = any(p_slot_ids)
  loop
    select array_agg(id) into v_window_ids
    from public.slots
    where date = v_start.date
      and status = 'open'
      and start_time >= v_start.start_time
      and start_time <  v_start.start_time + interval '4 hours'
    for update;

    if v_window_ids is not null then
      v_block_ids := v_block_ids || v_window_ids;
    end if;
  end loop;

  if coalesce(array_length(v_block_ids, 1), 0) = 0 then
    raise exception 'NO_SLOTS' using errcode = 'P0001';
  end if;

  -- 4. Create the booking, then flip the claimed slots to pending. Both run in
  --    this same transaction, so they commit together or not at all.
  insert into public.bookings (
    slot_id, services, property_address, client_name, client_email,
    notes, status, booking_type
  )
  values (
    p_slot_ids[1], p_services, p_property_address, p_client_name, p_client_email,
    p_notes, 'pending', 'half_day'
  )
  returning id into v_booking_id;

  update public.slots
  set status = 'pending', booking_id = v_booking_id
  where id = any(v_block_ids) and status = 'open';

  return v_booking_id;
end;
$$;

-- Only the service role should reach this. Revoke the implicit grants.
revoke all on function public.reserve_booking(uuid[], text[], text, text, text, text) from public;
revoke all on function public.reserve_booking(uuid[], text[], text, text, text, text) from anon;
revoke all on function public.reserve_booking(uuid[], text[], text, text, text, text) from authenticated;

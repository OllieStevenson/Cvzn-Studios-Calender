"use client";

import { useState, useTransition } from "react";
import Image from "next/image";
import { approveBooking, declineBooking, addSlots, deleteSlot } from "./actions";

interface Slot {
  id: string;
  date: string;
  start_time: string;
  status: "open" | "pending" | "confirmed";
}

interface Session {
  date: string;
  start_time: string;
}

interface Booking {
  id: string;
  slot_id: string;
  services: string[];
  property_address: string;
  client_name: string;
  client_email: string;
  notes: string | null;
  status: "pending" | "confirmed" | "declined";
  booking_type: "half_day" | "full_day";
  created_at: string;
  slots: Slot;
  sessions: Session[];
}

interface Props {
  bookings: Booking[];
  openSlots: Slot[];
}

function formatTime(time: string) {
  const [h, m] = time.split(":").map(Number);
  const period = h >= 12 ? "pm" : "am";
  return `${h % 12 || 12}:${String(m).padStart(2, "0")}${period}`;
}

function addHours(time: string, hours: number): string {
  const [h] = time.split(":").map(Number);
  return `${String(h + hours).padStart(2, "0")}:00:00`;
}

function formatDate(dateStr: string) {
  return new Date(dateStr + "T12:00:00").toLocaleDateString("en-GB", {
    weekday: "short", day: "numeric", month: "short", year: "numeric",
  });
}

function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    pending:   "bg-amber-50 text-amber-700 border-amber-200",
    confirmed: "bg-green-50 text-green-700 border-green-200",
    declined:  "bg-gray-100 text-gray-400 border-gray-200",
  };
  return (
    <span className={`text-xs font-medium px-2.5 py-1 rounded-full border capitalize whitespace-nowrap ${styles[status] ?? ""}`}>
      {status}
    </span>
  );
}

const PRESET_TIMES = [
  "08:00:00","09:00:00","10:00:00","11:00:00",
  "12:00:00","13:00:00","14:00:00","15:00:00","16:00:00",
];

export default function DashboardClient({ bookings, openSlots }: Props) {
  const [isPending, startTransition] = useTransition();
  const [tab, setTab] = useState<"requests" | "availability">("requests");
  const [addDate, setAddDate] = useState("");
  const [selectedTimes, setSelectedTimes] = useState<string[]>([]);
  const [addError, setAddError] = useState<string | null>(null);
  const [addSuccess, setAddSuccess] = useState(false);

  const pending = bookings.filter((b) => b.status === "pending");
  const earlier = bookings.filter((b) => b.status !== "pending");

  function toggleTime(t: string) {
    setSelectedTimes((ts) => ts.includes(t) ? ts.filter((x) => x !== t) : [...ts, t]);
  }

  function handleAddSlots(e: React.FormEvent) {
    e.preventDefault();
    if (!addDate || selectedTimes.length === 0) return;
    setAddError(null);
    setAddSuccess(false);
    startTransition(async () => {
      const result = await addSlots(addDate, selectedTimes);
      if (result?.error) {
        setAddError(
          result.error.includes("unique")
            ? "One of those times already exists on that date."
            : result.error
        );
      } else {
        setAddSuccess(true);
        setAddDate("");
        setSelectedTimes([]);
        setTimeout(() => setAddSuccess(false), 3000);
      }
    });
  }

  return (
    <div className="min-h-screen bg-gray-50 text-gray-900">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 px-4 sm:px-6 py-4">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Image src="/logo.png" alt="CVZN Studios" height={120} width={510} className="h-[108px] sm:h-[120px] w-auto" />
            <span className="text-gray-300 hidden sm:block">|</span>
            <span className="text-sm text-gray-500 hidden sm:block">Dashboard</span>
          </div>
          {pending.length > 0 && (
            <span className="bg-gray-900 text-white text-xs font-medium px-2.5 py-1 rounded-full">
              {pending.length} pending
            </span>
          )}
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 sm:px-6 py-6 sm:py-8 space-y-5 sm:space-y-6">
        {/* Tabs */}
        <div className="flex gap-1 bg-gray-100 p-1 rounded-lg w-full sm:w-fit">
          {(["requests", "availability"] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={[
                "flex-1 sm:flex-none px-4 py-2 rounded-md text-sm font-medium transition-colors touch-manipulation",
                tab === t ? "bg-white text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-700",
              ].join(" ")}
            >
              {t === "requests"
                ? `Requests${pending.length > 0 ? ` (${pending.length})` : ""}`
                : "Availability"}
            </button>
          ))}
        </div>

        {/* ── Requests tab ── */}
        {tab === "requests" && (
          <div className="space-y-4">
            {bookings.length === 0 && (
              <div className="bg-white rounded-xl border border-gray-200 p-10 text-center text-gray-400 text-sm">
                No booking requests yet.
              </div>
            )}
            {pending.length > 0 && (
              <div className="space-y-3">
                <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wider px-1">Pending</h2>
                {pending.map((b) => (
                  <BookingCard
                    key={b.id} booking={b} disabled={isPending}
                    onApprove={() => startTransition(() => approveBooking(b.id))}
                    onDecline={() => startTransition(() => declineBooking(b.id))}
                  />
                ))}
              </div>
            )}
            {earlier.length > 0 && (
              <div className="space-y-3">
                <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wider px-1 mt-2">Earlier</h2>
                {earlier.map((b) => (
                  <BookingCard
                    key={b.id} booking={b} disabled={isPending}
                    onApprove={() => startTransition(() => approveBooking(b.id))}
                    onDecline={() => startTransition(() => declineBooking(b.id))}
                  />
                ))}
              </div>
            )}
          </div>
        )}

        {/* ── Availability tab ── */}
        {tab === "availability" && (
          <div className="space-y-5">
            <div className="bg-white rounded-xl border border-gray-200 p-5 sm:p-6 space-y-5">
              <h2 className="font-medium">Add availability</h2>
              <form onSubmit={handleAddSlots} className="space-y-5">
                <div className="space-y-1.5">
                  <label className="text-sm text-gray-600">Date</label>
                  <input
                    type="date"
                    required
                    value={addDate}
                    min={new Date().toISOString().split("T")[0]}
                    onChange={(e) => setAddDate(e.target.value)}
                    className="w-full sm:w-auto border border-gray-200 rounded-lg px-3.5 py-3 text-sm focus:outline-none focus:border-gray-900 transition-colors"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm text-gray-600">Time slots — tap to select</label>
                  <div className="flex flex-wrap gap-2">
                    {PRESET_TIMES.map((t) => (
                      <button
                        key={t}
                        type="button"
                        onClick={() => toggleTime(t)}
                        className={[
                          "px-3.5 py-2.5 rounded-lg text-sm border transition-colors touch-manipulation",
                          selectedTimes.includes(t)
                            ? "bg-gray-900 text-white border-gray-900"
                            : "border-gray-300 hover:border-gray-900 hover:bg-gray-50",
                        ].join(" ")}
                      >
                        {formatTime(t)}
                      </button>
                    ))}
                  </div>
                </div>
                {addError   && <p className="text-sm text-red-600">{addError}</p>}
                {addSuccess && <p className="text-sm text-green-600">Slots added successfully.</p>}
                <button
                  type="submit"
                  disabled={isPending || !addDate || selectedTimes.length === 0}
                  className="w-full sm:w-auto bg-gray-900 text-white px-5 py-3 rounded-lg text-sm font-medium hover:bg-gray-700 transition-colors disabled:opacity-40 disabled:cursor-not-allowed touch-manipulation"
                >
                  {isPending
                    ? "Adding…"
                    : `Add ${selectedTimes.length > 0 ? selectedTimes.length + " " : ""}slot${selectedTimes.length !== 1 ? "s" : ""}`}
                </button>
              </form>
            </div>

            {openSlots.length > 0 && (
              <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                <div className="px-5 py-4 border-b border-gray-100">
                  <h2 className="font-medium text-sm">Open slots</h2>
                </div>
                <div className="divide-y divide-gray-100">
                  {openSlots.map((slot) => (
                    <div key={slot.id} className="px-5 py-3.5 flex items-center justify-between gap-4">
                      <span className="text-sm">
                        {formatDate(slot.date)}
                        <span className="text-gray-400 ml-1">— {formatTime(slot.start_time)}</span>
                      </span>
                      <button
                        onClick={() => startTransition(() => deleteSlot(slot.id))}
                        disabled={isPending}
                        className="text-xs text-gray-400 hover:text-red-500 transition-colors disabled:opacity-40 shrink-0 touch-manipulation"
                      >
                        Remove
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}

function BookingCard({
  booking: b, disabled, onApprove, onDecline,
}: {
  booking: Booking;
  disabled: boolean;
  onApprove: () => void;
  onDecline: () => void;
}) {
  const sessions = b.sessions.length > 0
    ? b.sessions
    : [{ date: b.slots?.date, start_time: b.slots?.start_time }].filter(Boolean) as Session[];

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4 sm:p-5 space-y-3.5">
      <div className="flex items-start justify-between gap-3">
        <div className="space-y-1 min-w-0">
          <p className="font-medium text-sm truncate">{b.property_address}</p>
          <div className="space-y-0.5">
            {sessions.map((s, i) => (
              <p key={i} className="text-sm text-gray-500">
                {formatDate(s.date)} · {formatTime(s.start_time)}–{formatTime(addHours(s.start_time, 4))}
              </p>
            ))}
          </div>
          {sessions.length > 1 && (
            <p className="text-xs text-gray-400">{sessions.length} sessions</p>
          )}
        </div>
        <StatusBadge status={b.status} />
      </div>

      <div className="text-sm text-gray-600 space-y-0.5">
        {b.services?.length > 0 && (
          <p className="flex flex-wrap gap-1 mb-1">
            {b.services.map((s) => (
              <span key={s} className="text-xs px-2 py-0.5 bg-gray-100 text-gray-600 rounded-full">{s}</span>
            ))}
          </p>
        )}
        <p className="truncate">
          {b.client_name} ·{" "}
          <a href={`mailto:${b.client_email}`} className="text-gray-900 underline underline-offset-2">
            {b.client_email}
          </a>
        </p>
        {b.notes && (
          <p className="text-gray-400 italic text-xs">&ldquo;{b.notes}&rdquo;</p>
        )}
      </div>

      {b.status === "pending" && (
        <div className="flex gap-2 pt-0.5">
          <button
            onClick={onApprove}
            disabled={disabled}
            className="flex-1 sm:flex-none px-5 py-2.5 bg-gray-900 text-white text-sm rounded-lg hover:bg-gray-700 transition-colors disabled:opacity-40 touch-manipulation"
          >
            Approve
          </button>
          <button
            onClick={onDecline}
            disabled={disabled}
            className="flex-1 sm:flex-none px-5 py-2.5 border border-gray-300 text-sm rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-40 touch-manipulation"
          >
            Decline
          </button>
        </div>
      )}

      <p className="text-xs text-gray-300">
        {new Date(b.created_at).toLocaleString("en-GB", {
          day: "numeric", month: "short", hour: "2-digit", minute: "2-digit",
        })}
      </p>
    </div>
  );
}

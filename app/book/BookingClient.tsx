"use client";

import { useState, useTransition, useEffect, useRef } from "react";
import Image from "next/image";
import { submitBooking } from "./actions";

interface Slot {
  id: string;
  date: string;
  start_time: string;
  status: "open" | "pending" | "confirmed";
}

interface Props {
  initialSlots: Slot[];
}

const MONTHS = [
  "January","February","March","April","May","June",
  "July","August","September","October","November","December",
];
const DAY_NAMES = ["Mon","Tue","Wed","Thu","Fri","Sat","Sun"];

function toDateKey(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
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

function formatDateShort(dateStr: string) {
  return new Date(dateStr + "T12:00:00").toLocaleDateString("en-GB", {
    weekday: "short", day: "numeric", month: "short",
  });
}

function formatDateLong(dateStr: string) {
  return new Date(dateStr + "T12:00:00").toLocaleDateString("en-GB", {
    weekday: "long", day: "numeric", month: "long", year: "numeric",
  });
}

function getCalendarDays(year: number, month: number) {
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  let startDow = firstDay.getDay() - 1;
  if (startDow < 0) startDow = 6;
  const days: (Date | null)[] = [];
  for (let i = 0; i < startDow; i++) days.push(null);
  for (let d = 1; d <= lastDay.getDate(); d++) days.push(new Date(year, month, d));
  while (days.length < 42) days.push(null);
  return days;
}

export default function BookingClient({ initialSlots }: Props) {
  const today = new Date();
  const todayKey = toDateKey(today);

  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth());
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [selectedSessions, setSelectedSessions] = useState<Slot[]>([]);
  const [slots, setSlots] = useState<Slot[]>(initialSlots);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [form, setForm] = useState({
    propertyAddress: "",
    clientName: "",
    clientEmail: "",
    notes: "",
  });

  // Fade out the page transition overlay on mount
  useEffect(() => {
    const overlay = document.getElementById('pt-overlay')
    if (!overlay) return
    requestAnimationFrame(() => {
      overlay.classList.remove('pt-in')
      overlay.classList.add('pt-out')
      const t = setTimeout(() => overlay.classList.remove('pt-out'), 700)
      return () => clearTimeout(t)
    })
  }, [])

  // Cursor parallax — desktop only
  const bgRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const hasMouseCursor = window.matchMedia("(hover: hover) and (pointer: fine)").matches;
    if (!hasMouseCursor) return;
    if (bgRef.current) bgRef.current.style.transform = "scale(1.08)";
    const handleMouseMove = (e: MouseEvent) => {
      const x = (e.clientX / window.innerWidth - 0.5) * 2;
      const y = (e.clientY / window.innerHeight - 0.5) * 2;
      if (bgRef.current) {
        bgRef.current.style.transform = `scale(1.08) translate(${x * -12}px, ${y * -12}px)`;
      }
    };
    window.addEventListener("mousemove", handleMouseMove);
    return () => window.removeEventListener("mousemove", handleMouseMove);
  }, []);

  const mySlotIds = new Set(selectedSessions.map((s) => s.id));

  const slotsByDate = slots.reduce<Record<string, Slot[]>>((acc, slot) => {
    if (!acc[slot.date]) acc[slot.date] = [];
    acc[slot.date].push(slot);
    return acc;
  }, {});

  const calendarDays = getCalendarDays(year, month);

  function prevMonth() {
    if (month === 0) { setYear((y) => y - 1); setMonth(11); }
    else setMonth((m) => m - 1);
    setSelectedDate(null);
  }

  function nextMonth() {
    if (month === 11) { setYear((y) => y + 1); setMonth(0); }
    else setMonth((m) => m + 1);
    setSelectedDate(null);
  }

  function handleSlotClick(slot: Slot) {
    if (mySlotIds.has(slot.id)) {
      // Already selected — remove it
      setSelectedSessions((prev) => prev.filter((s) => s.id !== slot.id));
    } else if (slot.status === "open") {
      // Add to sessions, close the time picker
      setSelectedSessions((prev) => [...prev, slot]);
      setSelectedDate(null);
    }
  }

  function removeSession(slotId: string) {
    setSelectedSessions((prev) => prev.filter((s) => s.id !== slotId));
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (selectedSessions.length === 0) return;
    setError(null);
    startTransition(async () => {
      const result = await submitBooking({
        slotIds: selectedSessions.map((s) => s.id),
        ...form,
      });
      if (result.error) {
        setError(result.error);
      } else {
        // Optimistically mark all selected sessions' 4-hour blocks as pending
        setSlots((prev) =>
          prev.map((sl) => {
            const session = selectedSessions.find((s) => s.date === sl.date);
            if (!session) return sl;
            const sessionHour = parseInt(session.start_time.split(":")[0]);
            const slHour = parseInt(sl.start_time.split(":")[0]);
            return slHour >= sessionHour && slHour < sessionHour + 4
              ? { ...sl, status: "pending" }
              : sl;
          })
        );
        setSubmitted(true);
      }
    });
  }

  const slotsForDate = selectedDate ? (slotsByDate[selectedDate] ?? []) : [];
  const sortedSessions = selectedSessions
    .slice()
    .sort((a, b) => a.date.localeCompare(b.date) || a.start_time.localeCompare(b.start_time));

  // ── Confirmation screen ──────────────────────────────────────────────
  if (submitted) {
    return (
      <div className="relative min-h-screen overflow-hidden">
        <div className="fixed inset-0 -z-10" style={{ backgroundImage: "url('/bg.jpg')", backgroundSize: "cover", backgroundPosition: "center" }} />
        <div className="fixed inset-0 -z-10 bg-black/50" />
        <div className="relative z-10 min-h-screen flex flex-col items-center justify-center p-6">
          <div className="bg-white/10 backdrop-blur-md border border-white/20 rounded-2xl p-10 text-center space-y-5 max-w-sm w-full shadow-2xl">
            <div className="w-12 h-12 rounded-full bg-white/20 text-white flex items-center justify-center mx-auto text-xl">✓</div>
            <div>
              <h2 className="text-xl font-semibold text-white">Request received</h2>
              <p className="text-white/60 text-sm mt-1.5 leading-relaxed">
                We've sent a confirmation to your email and will be in touch within 24 hours.
              </p>
            </div>
            {sortedSessions.length > 0 && (
              <div className="text-left space-y-1.5 border-t border-white/10 pt-4">
                {sortedSessions.map((s) => (
                  <p key={s.id} className="text-xs text-white/50">
                    {formatDateShort(s.date)} · {formatTime(s.start_time)}–{formatTime(addHours(s.start_time, 4))}
                  </p>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  // ── Main layout ──────────────────────────────────────────────────────
  return (
    <div className="relative min-h-screen overflow-hidden">
      <div
        ref={bgRef}
        className="fixed inset-0 -z-10"
        style={{
          backgroundImage: "url('/bg.jpg')",
          backgroundSize: "cover",
          backgroundPosition: "center",
          transition: "transform 0.15s ease-out",
          willChange: "transform",
        }}
      />
      <div className="fixed inset-0 -z-10 bg-black/50" />

      {/* Header */}
      <header className="relative z-10 px-4 sm:px-8 py-5 flex items-center justify-between">
        <div className="relative inline-block" style={{ height: "160px", width: "280px" }}>
          <Image src="/logo.png" alt="CVZN Studios" height={160} width={280} className="h-[160px] w-auto brightness-0 invert" />
          <Image src="/icon.png" alt="" width={47} height={47} className="absolute" style={{ left: "20.7px", top: "56.45px" }} />
        </div>
        <span className="hidden sm:block text-sm text-white/60">Visual Property Marketing</span>
      </header>

      <div className="relative z-10 flex justify-center px-4 pb-12 pt-4">
        <div className="w-full max-w-lg">
          <div className="bg-white/10 backdrop-blur-md border border-white/20 rounded-2xl shadow-2xl overflow-hidden">

            {/* Card header */}
            <div className="px-6 pt-6 pb-4 border-b border-white/10">
              <h1 className="text-xl font-semibold text-white tracking-tight">Book a shoot</h1>
              <p className="text-white/60 text-sm mt-0.5">Select one or more dates and times.</p>
            </div>

            <div className="px-4 sm:px-6 py-5 space-y-5">

              {/* Calendar */}
              <div className="rounded-xl overflow-hidden border border-white/15">
                <div className="flex items-center justify-between px-4 py-3 border-b border-white/10">
                  <button onClick={prevMonth} className="w-9 h-9 flex items-center justify-center rounded-lg hover:bg-white/10 active:bg-white/20 transition-colors touch-manipulation" aria-label="Previous month">
                    <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
                  </button>
                  <span className="font-medium text-sm text-white">{MONTHS[month]} {year}</span>
                  <button onClick={nextMonth} className="w-9 h-9 flex items-center justify-center rounded-lg hover:bg-white/10 active:bg-white/20 transition-colors touch-manipulation" aria-label="Next month">
                    <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
                  </button>
                </div>

                <div className="grid grid-cols-7 border-b border-white/10">
                  {DAY_NAMES.map((d) => (
                    <div key={d} className="py-2 text-center text-xs font-medium text-white/40">{d}</div>
                  ))}
                </div>

                <div className="grid grid-cols-7">
                  {calendarDays.map((day, i) => {
                    if (!day) return <div key={`empty-${i}`} className="aspect-square" />;
                    const key = toDateKey(day);
                    const daySlots = slotsByDate[key] ?? [];
                    const hasMySession = selectedSessions.some((s) => s.date === key);
                    const hasOpen = daySlots.some((s) => s.status === "open" && !mySlotIds.has(s.id));
                    const hasPending = !hasOpen && !hasMySession && daySlots.some((s) => s.status === "pending");
                    const isSelected = selectedDate === key;
                    const isPast = key < todayKey;
                    const isToday = key === todayKey;
                    const isClickable = !isPast && (hasOpen || hasMySession);

                    return (
                      <button
                        key={key}
                        onClick={() => isClickable && setSelectedDate(isSelected ? null : key)}
                        disabled={!isClickable}
                        className={[
                          "aspect-square min-h-[40px] flex flex-col items-center justify-center gap-0.5 text-sm transition-colors touch-manipulation select-none",
                          isSelected ? "bg-white/25 text-white font-semibold" : "",
                          !isSelected && hasOpen ? "text-green-300 hover:bg-white/10 active:bg-white/20 cursor-pointer" : "",
                          !isSelected && hasMySession && !hasOpen ? "text-amber-300 hover:bg-white/10 cursor-pointer" : "",
                          !isSelected && hasMySession && hasOpen ? "text-green-300 hover:bg-white/10 cursor-pointer" : "",
                          isPast || (!hasOpen && !hasPending && !hasMySession) ? "text-white/20 cursor-default" : "",
                          !isPast && hasPending && !isSelected ? "text-white/30" : "",
                          isToday && !isSelected ? "font-semibold" : "",
                        ].filter(Boolean).join(" ")}
                      >
                        <span>{day.getDate()}</span>
                        {!isPast && (hasOpen || hasPending || hasMySession) && (
                          <span className={[
                            "w-1 h-1 rounded-full",
                            isSelected ? "bg-white" :
                            hasMySession ? "bg-amber-400" :
                            hasOpen ? "bg-green-400" : "bg-white/30",
                          ].join(" ")} />
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Legend */}
              <p className="text-xs text-white/40 flex items-center gap-4 flex-wrap">
                <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-green-400 inline-block" /> Available</span>
                <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-amber-400 inline-block" /> Selected</span>
                <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-white/30 inline-block" /> Pending</span>
              </p>

              {/* Time slot picker */}
              {selectedDate && (
                <div className="space-y-3">
                  <h2 className="font-medium text-sm text-white/80">{formatDateLong(selectedDate)}</h2>
                  {slotsForDate.length === 0 ? (
                    <p className="text-sm text-white/40">No slots available on this date.</p>
                  ) : (
                    <div className="flex flex-wrap gap-2">
                      {slotsForDate.map((slot) => {
                        const isMine = mySlotIds.has(slot.id);
                        return (
                          <button
                            key={slot.id}
                            onClick={() => handleSlotClick(slot)}
                            disabled={slot.status !== "open" && !isMine}
                            className={[
                              "px-3.5 py-2 rounded-lg text-sm font-medium border transition-colors touch-manipulation",
                              isMine
                                ? "bg-amber-400/20 border-amber-400/50 text-amber-300 hover:bg-amber-400/30"
                                : slot.status === "open"
                                ? "border-white/30 text-white hover:bg-white/20 active:bg-white/30"
                                : "border-white/10 text-white/25 cursor-default",
                            ].join(" ")}
                          >
                            {formatTime(slot.start_time)}
                            {isMine && <span className="ml-1.5 text-xs opacity-80">✓</span>}
                            {!isMine && slot.status !== "open" && <span className="ml-1 text-xs font-normal">(taken)</span>}
                          </button>
                        );
                      })}
                    </div>
                  )}
                  <p className="text-xs text-white/35">Each session is 4 hours. Tap a time to add it — tap ✓ to remove.</p>
                </div>
              )}

              {/* Selected sessions list */}
              {selectedSessions.length > 0 && (
                <div className="space-y-2 border-t border-white/10 pt-4">
                  <h2 className="text-sm font-medium text-white/80">
                    {selectedSessions.length === 1 ? "1 session selected" : `${selectedSessions.length} sessions selected`}
                  </h2>
                  <div className="space-y-1.5">
                    {sortedSessions.map((session) => (
                      <div key={session.id} className="flex items-center justify-between bg-white/5 rounded-lg px-3.5 py-2.5">
                        <p className="text-sm text-white">
                          {formatDateShort(session.date)}
                          <span className="text-white/50 ml-2">
                            {formatTime(session.start_time)} – {formatTime(addHours(session.start_time, 4))}
                          </span>
                        </p>
                        <button
                          onClick={() => removeSession(session.id)}
                          className="text-white/30 hover:text-white/70 transition-colors ml-3 touch-manipulation text-lg leading-none"
                          aria-label="Remove session"
                        >
                          ×
                        </button>
                      </div>
                    ))}
                  </div>
                  {!selectedDate && (
                    <button
                      onClick={() => setSelectedDate(null)}
                      className="text-xs text-white/40 hover:text-white/70 transition-colors touch-manipulation"
                    >
                      + Add another date
                    </button>
                  )}
                </div>
              )}

              {/* Booking form */}
              {selectedSessions.length > 0 && (
                <form onSubmit={handleSubmit} className="space-y-4 border-t border-white/10 pt-5">
                  <h2 className="font-medium text-white text-sm">Your details</h2>

                  <div className="space-y-1.5">
                    <label className="text-xs text-white/60">Property address</label>
                    <input
                      type="text"
                      required
                      value={form.propertyAddress}
                      onChange={(e) => setForm((f) => ({ ...f, propertyAddress: e.target.value }))}
                      className="w-full bg-white/10 border border-white/20 rounded-lg px-3.5 py-2.5 text-sm text-white placeholder-white/30 focus:outline-none focus:border-white/50 transition-colors"
                      placeholder="12 High Street, London, SW1A 1AA"
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <label className="text-xs text-white/60">Your name</label>
                      <input
                        type="text"
                        required
                        value={form.clientName}
                        onChange={(e) => setForm((f) => ({ ...f, clientName: e.target.value }))}
                        className="w-full bg-white/10 border border-white/20 rounded-lg px-3.5 py-2.5 text-sm text-white placeholder-white/30 focus:outline-none focus:border-white/50 transition-colors"
                        placeholder="Jane Smith"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-xs text-white/60">Email address</label>
                      <input
                        type="email"
                        required
                        value={form.clientEmail}
                        onChange={(e) => setForm((f) => ({ ...f, clientEmail: e.target.value }))}
                        className="w-full bg-white/10 border border-white/20 rounded-lg px-3.5 py-2.5 text-sm text-white placeholder-white/30 focus:outline-none focus:border-white/50 transition-colors"
                        placeholder="jane@agency.com"
                      />
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs text-white/60">Notes <span className="text-white/30">(optional)</span></label>
                    <textarea
                      value={form.notes}
                      onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
                      rows={3}
                      className="w-full bg-white/10 border border-white/20 rounded-lg px-3.5 py-2.5 text-sm text-white placeholder-white/30 focus:outline-none focus:border-white/50 transition-colors resize-none"
                      placeholder="Access instructions, number of rooms, anything useful…"
                    />
                  </div>

                  {error && <p className="text-sm text-red-300">{error}</p>}

                  <button
                    type="submit"
                    disabled={isPending}
                    className="w-full bg-white text-gray-900 py-3 rounded-lg text-sm font-semibold hover:bg-white/90 active:bg-white/80 transition-colors disabled:opacity-50 disabled:cursor-not-allowed touch-manipulation"
                  >
                    {isPending
                      ? "Sending request…"
                      : selectedSessions.length === 1
                      ? "Request this slot"
                      : `Request ${selectedSessions.length} sessions`}
                  </button>

                  <p className="text-xs text-white/30 text-center pb-1">
                    We'll confirm your booking by email within 24 hours.
                  </p>
                </form>
              )}

            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

"use client";

import { useState, useTransition } from "react";
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

function addHours(time: string, hours: number) {
  const [h] = time.split(":").map(Number);
  return `${String(h + hours).padStart(2, "0")}:00:00`;
}

function getCalendarDays(year: number, month: number) {
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  let startDow = firstDay.getDay() - 1;
  if (startDow < 0) startDow = 6;
  const days: (Date | null)[] = [];
  for (let i = 0; i < startDow; i++) days.push(null);
  for (let d = 1; d <= lastDay.getDate(); d++) days.push(new Date(year, month, d));
  return days;
}

export default function BookingClient({ initialSlots }: Props) {
  const today = new Date();
  const todayKey = toDateKey(today);

  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth());
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [selectedSlot, setSelectedSlot] = useState<Slot | null>(null);
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

  const slotsByDate = slots.reduce<Record<string, Slot[]>>((acc, slot) => {
    if (!acc[slot.date]) acc[slot.date] = [];
    acc[slot.date].push(slot);
    return acc;
  }, {});

  const calendarDays = getCalendarDays(year, month);

  function prevMonth() {
    if (month === 0) { setYear((y) => y - 1); setMonth(11); }
    else setMonth((m) => m - 1);
    setSelectedDate(null); setSelectedSlot(null);
  }

  function nextMonth() {
    if (month === 11) { setYear((y) => y + 1); setMonth(0); }
    else setMonth((m) => m + 1);
    setSelectedDate(null); setSelectedSlot(null);
  }

  function selectDate(day: Date) {
    setSelectedDate(toDateKey(day));
    setSelectedSlot(null);
    setError(null);
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedSlot) return;
    setError(null);
    startTransition(async () => {
      const result = await submitBooking({ slotId: selectedSlot.id, bookingType: "half_day", ...form });
      if (result.error) {
        setError(result.error);
      } else {
        const startHour = parseInt(selectedSlot.start_time.split(":")[0]);
        setSlots((s) =>
          s.map((sl) => {
            if (sl.date !== selectedSlot.date) return sl;
            const slHour = parseInt(sl.start_time.split(":")[0]);
            return slHour >= startHour && slHour < startHour + 4 ? { ...sl, status: "pending" } : sl;
          })
        );
        setSubmitted(true);
      }
    });
  }

  if (submitted) {
    return (
      <div className="min-h-screen flex flex-col">
        <header className="border-b border-gray-100 px-4 sm:px-6 py-4">
          <div className="max-w-2xl mx-auto">
            <Image src="/logo.png" alt="CVZN Studios" height={40} width={170} className="h-10 w-auto" />
          </div>
        </header>
        <div className="flex-1 flex items-center justify-center p-8">
          <div className="text-center space-y-4 max-w-sm">
            <div className="w-12 h-12 rounded-full bg-gray-900 text-white flex items-center justify-center mx-auto text-xl">✓</div>
            <h2 className="text-xl font-semibold">Request received</h2>
            <p className="text-gray-500 text-sm leading-relaxed">
              Thanks — Ollie will confirm your shoot by email within 24 hours.
            </p>
          </div>
        </div>
      </div>
    );
  }

  const slotsForDate = selectedDate ? (slotsByDate[selectedDate] ?? []) : [];

  return (
    <div className="min-h-screen bg-white">
      <header className="sticky top-0 z-10 bg-white border-b border-gray-100 px-4 sm:px-6 py-4">
        <div className="max-w-2xl mx-auto flex items-center justify-between">
          <Image src="/logo.png" alt="CVZN Studios" height={40} width={170} className="h-10 w-auto" />
          <span className="hidden sm:block text-sm text-gray-400">Visual Property Marketing</span>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 sm:px-6 py-8 sm:py-10 space-y-6 sm:space-y-8">
        <div>
          <h1 className="text-xl sm:text-2xl font-semibold tracking-tight">Book a shoot</h1>
          <p className="text-gray-500 mt-1 text-sm">Select a date and start time. Each booking covers a 4-hour slot.</p>
        </div>

        {/* Calendar */}
        <div className="border border-gray-200 rounded-xl overflow-hidden">
          <div className="flex items-center justify-between px-4 sm:px-5 py-3 sm:py-4 border-b border-gray-100">
            <button onClick={prevMonth} className="w-9 h-9 flex items-center justify-center rounded-lg hover:bg-gray-100 active:bg-gray-200 transition-colors touch-manipulation" aria-label="Previous month">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
            </button>
            <span className="font-medium text-sm">{MONTHS[month]} {year}</span>
            <button onClick={nextMonth} className="w-9 h-9 flex items-center justify-center rounded-lg hover:bg-gray-100 active:bg-gray-200 transition-colors touch-manipulation" aria-label="Next month">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
            </button>
          </div>

          <div className="grid grid-cols-7 border-b border-gray-100">
            {DAY_NAMES.map((d) => (
              <div key={d} className="py-2 text-center text-xs font-medium text-gray-400">{d}</div>
            ))}
          </div>

          <div className="grid grid-cols-7">
            {calendarDays.map((day, i) => {
              if (!day) return <div key={`empty-${i}`} className="aspect-square" />;
              const key = toDateKey(day);
              const daySlots = slotsByDate[key] ?? [];
              const hasOpen = daySlots.some((s) => s.status === "open");
              const hasPending = !hasOpen && daySlots.some((s) => s.status === "pending");
              const isSelected = selectedDate === key;
              const isPast = key < todayKey;
              const isToday = key === todayKey;
              const isClickable = !isPast && hasOpen;

              return (
                <button
                  key={key}
                  onClick={() => isClickable && selectDate(day)}
                  disabled={!isClickable}
                  className={[
                    "aspect-square min-h-[44px] flex flex-col items-center justify-center gap-0.5 text-sm transition-colors touch-manipulation select-none",
                    isSelected ? "bg-gray-900 text-white" : "",
                    !isSelected && isClickable ? "text-green-600 hover:bg-pink-50 active:bg-pink-100 cursor-pointer" : "",
                    isPast || (!hasOpen && !hasPending) ? "text-gray-300 cursor-default" : "",
                    !isPast && hasPending && !isSelected ? "text-gray-400" : "",
                    isToday && !isSelected ? "font-semibold" : "",
                  ].filter(Boolean).join(" ")}
                >
                  <span>{day.getDate()}</span>
                  {!isPast && (hasOpen || hasPending) && (
                    <span className={["w-1 h-1 rounded-full", isSelected ? "bg-white" : hasOpen ? "bg-green-500" : "bg-gray-300"].join(" ")} />
                  )}
                </button>
              );
            })}
          </div>
        </div>

        <p className="text-xs text-gray-400 flex items-center gap-4">
          <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-green-500 inline-block" /> Available</span>
          <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-gray-300 inline-block" /> Pending</span>
        </p>

        {/* Time slot picker */}
        {selectedDate && !selectedSlot && (
          <div className="space-y-3">
            <h2 className="font-medium text-sm text-gray-700">
              {new Date(selectedDate + "T12:00:00").toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}
            </h2>
            <p className="text-xs text-gray-400">Select a start time — your slot runs for 4 hours.</p>
            <div className="flex flex-wrap gap-2">
              {slotsForDate.map((slot) => (
                <button
                  key={slot.id}
                  onClick={() => slot.status === "open" && setSelectedSlot(slot)}
                  disabled={slot.status !== "open"}
                  className={[
                    "px-4 py-2.5 rounded-lg text-sm font-medium border transition-colors touch-manipulation",
                    slot.status === "open"
                      ? "border-gray-300 hover:border-gray-900 hover:bg-gray-50 active:bg-gray-100"
                      : "border-gray-100 text-gray-300 cursor-default",
                  ].join(" ")}
                >
                  {formatTime(slot.start_time)}
                  {slot.status !== "open" && <span className="ml-1.5 text-xs font-normal">(taken)</span>}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Selected slot summary */}
        {selectedSlot && (
          <div className="flex items-center justify-between py-1">
            <p className="text-sm font-medium text-gray-700">
              {formatTime(selectedSlot.start_time)} – {formatTime(addHours(selectedSlot.start_time, 4))}
              <span className="text-gray-400 font-normal ml-1.5">(4 hours)</span>
            </p>
            <button onClick={() => setSelectedSlot(null)} className="text-xs text-gray-400 hover:text-gray-600 touch-manipulation">← Change</button>
          </div>
        )}

        {/* Booking form */}
        {selectedSlot && (
          <form onSubmit={handleSubmit} className="space-y-5 border-t border-gray-100 pt-7">
            <h2 className="font-medium">Your details</h2>

            <div className="space-y-1.5">
              <label className="text-sm text-gray-600">
                Property address
                <span className="text-gray-400 font-normal ml-1 hidden sm:inline">(full address of the shoot location)</span>
              </label>
              <input
                type="text"
                required
                value={form.propertyAddress}
                onChange={(e) => setForm((f) => ({ ...f, propertyAddress: e.target.value }))}
                className="w-full border border-gray-200 rounded-lg px-3.5 py-3 text-sm focus:outline-none focus:border-gray-900 transition-colors"
                placeholder="12 High Street, London, SW1A 1AA"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-sm text-gray-600">Your name</label>
                <input
                  type="text"
                  required
                  value={form.clientName}
                  onChange={(e) => setForm((f) => ({ ...f, clientName: e.target.value }))}
                  className="w-full border border-gray-200 rounded-lg px-3.5 py-3 text-sm focus:outline-none focus:border-gray-900 transition-colors"
                  placeholder="Jane Smith"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-sm text-gray-600">Email address</label>
                <input
                  type="email"
                  required
                  value={form.clientEmail}
                  onChange={(e) => setForm((f) => ({ ...f, clientEmail: e.target.value }))}
                  className="w-full border border-gray-200 rounded-lg px-3.5 py-3 text-sm focus:outline-none focus:border-gray-900 transition-colors"
                  placeholder="jane@agency.com"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-sm text-gray-600">Notes <span className="text-gray-400 font-normal">(optional)</span></label>
              <textarea
                value={form.notes}
                onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
                rows={3}
                className="w-full border border-gray-200 rounded-lg px-3.5 py-3 text-sm focus:outline-none focus:border-gray-900 transition-colors resize-none"
                placeholder="Access instructions, number of rooms, anything useful…"
              />
            </div>

            {error && <p className="text-sm text-red-600">{error}</p>}

            <button
              type="submit"
              disabled={isPending}
              className="w-full bg-gray-900 text-white py-3.5 rounded-lg text-sm font-medium hover:bg-gray-700 active:bg-gray-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed touch-manipulation"
            >
              {isPending ? "Sending request…" : "Request this slot"}
            </button>

            <p className="text-xs text-gray-400 text-center pb-2">
              Ollie will confirm your booking by email within 24 hours.
            </p>
          </form>
        )}
      </main>
    </div>
  );
}

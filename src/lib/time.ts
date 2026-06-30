import { addDays } from "date-fns";
import { fromZonedTime, formatInTimeZone } from "date-fns-tz";
import type { WorkWindow } from "@/lib/types";

export interface Interval {
  start: Date;
  end: Date;
}

export const MINUTE = 60_000;

/** Local calendar day key (yyyy-MM-dd) for an instant in a timezone. */
function localDayKey(d: Date, tz: string): string {
  return formatInTimeZone(d, tz, "yyyy-MM-dd");
}

/** JS weekday (0=Sun … 6=Sat) for an instant in a timezone. */
function localWeekday(d: Date, tz: string): number {
  const iso = Number(formatInTimeZone(d, tz, "i")); // 1=Mon … 7=Sun
  return iso % 7;
}

/** Local clock hour (0–23) for an instant in a timezone. */
export function localHour(d: Date, tz: string): number {
  return Number(formatInTimeZone(d, tz, "H"));
}

/** Build the UTC instant for a wall-clock minute-of-day on a local day. */
function zonedInstant(dayKey: string, minuteOfDay: number, tz: string): Date {
  const hh = String(Math.floor(minuteOfDay / 60)).padStart(2, "0");
  const mm = String(minuteOfDay % 60).padStart(2, "0");
  return fromZonedTime(`${dayKey}T${hh}:${mm}:00`, tz);
}

function clampInterval(i: Interval, from: Date, to: Date): Interval | null {
  const start = i.start < from ? from : i.start;
  const end = i.end > to ? to : i.end;
  return end > start ? { start, end } : null;
}

/** Subtract a set of busy intervals from a single base interval. */
function subtractBusy(base: Interval, busy: Interval[]): Interval[] {
  const overlapping = busy
    .filter((b) => b.end > base.start && b.start < base.end)
    .sort((a, b) => a.start.getTime() - b.start.getTime());

  const result: Interval[] = [];
  let cursor = base.start;
  for (const b of overlapping) {
    if (b.start > cursor) {
      result.push({ start: cursor, end: b.start < base.end ? b.start : base.end });
    }
    if (b.end > cursor) cursor = b.end;
    if (cursor >= base.end) break;
  }
  if (cursor < base.end) result.push({ start: cursor, end: base.end });
  return result.filter((r) => r.end > r.start);
}

/**
 * Compute schedulable free slots inside [from, to]:
 * the user's recurring work windows, intersected with [from, to],
 * minus busy calendar intervals.
 */
export function computeFreeSlots(opts: {
  from: Date;
  to: Date;
  workWindows: WorkWindow[];
  busy: Interval[];
  tz: string;
  minSlotMinutes?: number;
}): Interval[] {
  const { from, to, workWindows, busy, tz } = opts;
  const minSlot = opts.minSlotMinutes ?? 15;

  // Collect every local day the window touches.
  const dayKeys = new Set<string>();
  let cur = from;
  while (cur <= to) {
    dayKeys.add(localDayKey(cur, tz));
    cur = addDays(cur, 1);
  }
  dayKeys.add(localDayKey(to, tz));

  // Build work intervals from windows matching each day's weekday.
  const workIntervals: Interval[] = [];
  for (const dayKey of dayKeys) {
    const weekday = localWeekday(zonedInstant(dayKey, 12 * 60, tz), tz);
    for (const w of workWindows) {
      if (w.weekday !== weekday) continue;
      const interval: Interval = {
        start: zonedInstant(dayKey, w.startMinute, tz),
        end: zonedInstant(dayKey, w.endMinute, tz),
      };
      const clamped = clampInterval(interval, from, to);
      if (clamped) workIntervals.push(clamped);
    }
  }

  workIntervals.sort((a, b) => a.start.getTime() - b.start.getTime());

  // Subtract busy from each work interval.
  const free: Interval[] = [];
  for (const wi of workIntervals) {
    for (const slot of subtractBusy(wi, busy)) {
      if (slot.end.getTime() - slot.start.getTime() >= minSlot * MINUTE) {
        free.push(slot);
      }
    }
  }
  free.sort((a, b) => a.start.getTime() - b.start.getTime());
  return free;
}

/** Total schedulable minutes across a set of intervals. */
export function totalMinutes(intervals: Interval[]): number {
  return intervals.reduce(
    (sum, i) => sum + (i.end.getTime() - i.start.getTime()) / MINUTE,
    0
  );
}

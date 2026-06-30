import { type Interval, MINUTE, localHour } from "@/lib/time";
import type { EnergyLevel } from "@/lib/types";

export interface SchedulableSubtask {
  id: string;
  /** Effort in minutes AFTER the personal effort multiplier is applied. */
  minutes: number;
  /** Subtask ids that must finish before this one can start. */
  deps: string[];
  energy: EnergyLevel;
  /** Lower = should be scheduled earlier among ready subtasks. */
  order: number;
}

export interface Placement {
  subtaskId: string;
  start: Date;
  end: Date;
  type: "work";
}

export interface RecoveryPlacement {
  start: Date;
  end: Date;
  type: "recovery";
}

export interface PackOptions {
  /** Earliest instant work may start (defaults to the first slot start). */
  earliest?: Date;
  /** Insert a recovery break after a work block at least this long. */
  recoveryAfterMinutes?: number;
  recoveryMinutes?: number;
  /** Chronotype peak hours (0–23). High-energy work prefers these. */
  preferredHours?: number[];
  tz?: string;
}

export interface PackResult {
  placements: Placement[];
  recovery: RecoveryPlacement[];
  /** Subtask ids that could not be placed before running out of free time. */
  unscheduled: string[];
}

/** Kahn topological sort; falls back to `order` for cycles / ties. */
function topoSort(subtasks: SchedulableSubtask[]): SchedulableSubtask[] {
  const byId = new Map(subtasks.map((s) => [s.id, s]));
  const indegree = new Map<string, number>();
  for (const s of subtasks) indegree.set(s.id, 0);
  for (const s of subtasks) {
    for (const d of s.deps) {
      if (byId.has(d)) indegree.set(s.id, (indegree.get(s.id) ?? 0) + 1);
    }
  }

  const ready = subtasks
    .filter((s) => (indegree.get(s.id) ?? 0) === 0)
    .sort((a, b) => a.order - b.order);
  const result: SchedulableSubtask[] = [];
  const remaining = new Set(subtasks.map((s) => s.id));

  while (ready.length > 0) {
    const next = ready.shift()!;
    result.push(next);
    remaining.delete(next.id);
    for (const s of subtasks) {
      if (!remaining.has(s.id)) continue;
      if (s.deps.includes(next.id)) {
        indegree.set(s.id, (indegree.get(s.id) ?? 1) - 1);
        if ((indegree.get(s.id) ?? 0) === 0) {
          ready.push(s);
          ready.sort((a, b) => a.order - b.order);
        }
      }
    }
  }

  // Any leftovers (dependency cycle) appended by order so they still schedule.
  if (remaining.size > 0) {
    const leftovers = subtasks
      .filter((s) => remaining.has(s.id))
      .sort((a, b) => a.order - b.order);
    result.push(...leftovers);
  }
  return result;
}

const sortIntervals = (a: Interval, b: Interval) =>
  a.start.getTime() - b.start.getTime();

/**
 * Greedy earliest-fit packing of subtasks into free slots, respecting
 * dependencies and inserting recovery breaks. Pure & deterministic.
 *
 * Strategy: process subtasks in topological order; for each, find the earliest
 * free slot that can hold it no sooner than its dependencies finish. For
 * high-energy work, prefer a slot whose start falls in the user's peak hours.
 */
export function packSubtasks(
  freeSlotsInput: Interval[],
  subtasks: SchedulableSubtask[],
  options: PackOptions = {}
): PackResult {
  const slots: Interval[] = freeSlotsInput
    .map((s) => ({ start: new Date(s.start), end: new Date(s.end) }))
    .sort(sortIntervals);

  const earliest = options.earliest ?? slots[0]?.start ?? new Date();
  const recoveryAfter = options.recoveryAfterMinutes ?? 0;
  const recoveryMins = options.recoveryMinutes ?? 0;
  const preferred = options.preferredHours;
  const tz = options.tz;

  const placements: Placement[] = [];
  const recovery: RecoveryPlacement[] = [];
  const unscheduled: string[] = [];
  const finishById = new Map<string, Date>();

  const ordered = topoSort(subtasks);

  // Monotonic cursor: a personal schedule is executed one subtask at a time in
  // sequence, so each placement must start no earlier than the previous one
  // finished. Without this, the peak-hour preference below could pull a
  // high-energy subtask into a later slot and let a lower-order subtask grab an
  // earlier one — scheduling a prerequisite *after* its dependents.
  let cursor = earliest;

  for (const st of ordered) {
    const need = st.minutes * MINUTE;

    // Earliest this subtask may start: after the previous subtask in sequence
    // (cursor) and after all its explicit dependencies finish.
    let minStart = cursor;
    for (const dep of st.deps) {
      const depEnd = finishById.get(dep);
      if (depEnd && depEnd > minStart) minStart = depEnd;
    }

    // Candidate slots that can fit the work at/after minStart.
    const candidates: { idx: number; startAt: Date }[] = [];
    for (let i = 0; i < slots.length; i++) {
      const slot = slots[i];
      const startAt = slot.start < minStart ? minStart : slot.start;
      if (startAt.getTime() + need <= slot.end.getTime()) {
        candidates.push({ idx: i, startAt });
      }
    }
    if (candidates.length === 0) {
      unscheduled.push(st.id);
      continue;
    }

    // Prefer peak-hour slots for high-energy work; else earliest.
    let chosen = candidates[0];
    if (st.energy === "high" && preferred && preferred.length > 0 && tz) {
      const peak = candidates.find((c) => preferred.includes(localHour(c.startAt, tz)));
      if (peak) chosen = peak;
    }

    const start = chosen.startAt;
    const end = new Date(start.getTime() + need);
    placements.push({ subtaskId: st.id, start, end, type: "work" });
    finishById.set(st.id, end);

    // Carve the work (and optional recovery) out of the chosen slot.
    const slot = slots[chosen.idx];
    let consumedEnd = end;
    if (recoveryAfter > 0 && recoveryMins > 0 && st.minutes >= recoveryAfter) {
      const recEnd = new Date(end.getTime() + recoveryMins * MINUTE);
      if (recEnd.getTime() <= slot.end.getTime()) {
        recovery.push({ start: end, end: recEnd, type: "recovery" });
        consumedEnd = recEnd;
      }
    }

    // Advance the sequence cursor past this work (and its recovery break) so the
    // next subtask in order is scheduled afterward.
    cursor = consumedEnd;

    const before: Interval | null =
      start.getTime() > slot.start.getTime()
        ? { start: slot.start, end: start }
        : null;
    const after: Interval | null =
      consumedEnd.getTime() < slot.end.getTime()
        ? { start: consumedEnd, end: slot.end }
        : null;

    slots.splice(chosen.idx, 1, ...[before, after].filter((x): x is Interval => !!x));
    slots.sort(sortIntervals);
  }

  return { placements, recovery, unscheduled };
}

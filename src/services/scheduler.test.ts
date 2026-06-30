import { describe, it, expect } from "vitest";
import { packSubtasks, type SchedulableSubtask } from "@/services/scheduler";
import type { Interval } from "@/lib/time";

const D = (iso: string) => new Date(iso);
const slot = (s: string, e: string): Interval => ({ start: D(s), end: D(e) });
const st = (
  id: string,
  minutes: number,
  extra: Partial<SchedulableSubtask> = {}
): SchedulableSubtask => ({
  id,
  minutes,
  deps: [],
  energy: "medium",
  order: 0,
  ...extra,
});

describe("packSubtasks", () => {
  it("places independent subtasks back-to-back, earliest first", () => {
    const free = [slot("2026-07-01T09:00:00Z", "2026-07-01T12:00:00Z")];
    const res = packSubtasks(free, [
      st("a", 60, { order: 0 }),
      st("b", 90, { order: 1 }),
    ]);
    expect(res.unscheduled).toEqual([]);
    const a = res.placements.find((p) => p.subtaskId === "a")!;
    const b = res.placements.find((p) => p.subtaskId === "b")!;
    expect(a.start.toISOString()).toBe("2026-07-01T09:00:00.000Z");
    expect(a.end.toISOString()).toBe("2026-07-01T10:00:00.000Z");
    expect(b.start.toISOString()).toBe("2026-07-01T10:00:00.000Z");
    expect(b.end.toISOString()).toBe("2026-07-01T11:30:00.000Z");
  });

  it("respects dependencies regardless of order field", () => {
    const free = [slot("2026-07-01T09:00:00Z", "2026-07-01T12:00:00Z")];
    // b sorts earlier by order, but depends on a → a must come first.
    const res = packSubtasks(free, [
      st("a", 60, { order: 5 }),
      st("b", 60, { order: 0, deps: ["a"] }),
    ]);
    const a = res.placements.find((p) => p.subtaskId === "a")!;
    const b = res.placements.find((p) => p.subtaskId === "b")!;
    expect(a.start.getTime()).toBeLessThan(b.start.getTime());
    expect(b.start.getTime()).toBeGreaterThanOrEqual(a.end.getTime());
  });

  it("inserts recovery breaks between qualifying work blocks", () => {
    const free = [slot("2026-07-01T09:00:00Z", "2026-07-01T12:00:00Z")];
    const res = packSubtasks(
      free,
      [st("a", 60, { order: 0 }), st("b", 60, { order: 1 })],
      { recoveryAfterMinutes: 60, recoveryMinutes: 15 }
    );
    expect(res.recovery).toHaveLength(2);
    const b = res.placements.find((p) => p.subtaskId === "b")!;
    // a: 9–10, recovery 10–10:15, b starts at 10:15.
    expect(b.start.toISOString()).toBe("2026-07-01T10:15:00.000Z");
  });

  it("marks subtasks that cannot fit as unscheduled", () => {
    const free = [slot("2026-07-01T09:00:00Z", "2026-07-01T10:00:00Z")];
    const res = packSubtasks(free, [
      st("fits", 45, { order: 0 }),
      st("toobig", 90, { order: 1 }),
    ]);
    expect(res.placements.map((p) => p.subtaskId)).toEqual(["fits"]);
    expect(res.unscheduled).toEqual(["toobig"]);
  });

  it("prefers peak hours for high-energy work", () => {
    // Two separate one-hour slots: 08:00 and 15:00 UTC.
    const free = [
      slot("2026-07-01T08:00:00Z", "2026-07-01T09:00:00Z"),
      slot("2026-07-01T15:00:00Z", "2026-07-01T16:00:00Z"),
    ];
    const res = packSubtasks(free, [st("deep", 60, { energy: "high" })], {
      preferredHours: [15],
      tz: "UTC",
    });
    expect(res.placements[0].start.toISOString()).toBe(
      "2026-07-01T15:00:00.000Z"
    );
  });

  it("keeps subtasks in order even when a high-energy task prefers a later peak slot", () => {
    // An early non-peak slot, and a later peak slot with room for both tasks.
    const free = [
      slot("2026-07-01T09:00:00Z", "2026-07-01T10:00:00Z"),
      slot("2026-07-01T15:00:00Z", "2026-07-01T18:00:00Z"),
    ];
    const res = packSubtasks(
      free,
      [
        st("first", 60, { order: 0, energy: "high" }),
        st("second", 60, { order: 1, energy: "medium" }),
      ],
      { preferredHours: [15], tz: "UTC" }
    );
    const first = res.placements.find((p) => p.subtaskId === "first")!;
    const second = res.placements.find((p) => p.subtaskId === "second")!;
    // High-energy "first" still prefers the 15:00 peak slot...
    expect(first.start.toISOString()).toBe("2026-07-01T15:00:00.000Z");
    // ...and "second" is scheduled after it, not pulled into the early slot.
    expect(second.start.getTime()).toBeGreaterThanOrEqual(first.end.getTime());
  });
});

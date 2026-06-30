import { describe, it, expect } from "vitest";
import { computeFreeSlots, totalMinutes, type Interval } from "@/lib/time";
import type { WorkWindow } from "@/lib/types";

// Work 09:00–17:00 every day (avoids weekday-specific assertions).
const allDayWindows: WorkWindow[] = [0, 1, 2, 3, 4, 5, 6].map((weekday) => ({
  weekday,
  startMinute: 9 * 60,
  endMinute: 17 * 60,
}));

describe("computeFreeSlots", () => {
  it("subtracts busy intervals from the work window (UTC)", () => {
    const free = computeFreeSlots({
      from: new Date("2026-07-06T00:00:00Z"),
      to: new Date("2026-07-06T23:59:00Z"),
      workWindows: allDayWindows,
      busy: [
        { start: new Date("2026-07-06T12:00:00Z"), end: new Date("2026-07-06T13:00:00Z") },
      ],
      tz: "UTC",
    });
    expect(free).toHaveLength(2);
    expect(free[0].start.toISOString()).toBe("2026-07-06T09:00:00.000Z");
    expect(free[0].end.toISOString()).toBe("2026-07-06T12:00:00.000Z");
    expect(free[1].start.toISOString()).toBe("2026-07-06T13:00:00.000Z");
    expect(free[1].end.toISOString()).toBe("2026-07-06T17:00:00.000Z");
  });

  it("clamps the window to the [from, to] range", () => {
    const free = computeFreeSlots({
      from: new Date("2026-07-06T10:30:00Z"),
      to: new Date("2026-07-06T15:00:00Z"),
      workWindows: allDayWindows,
      busy: [],
      tz: "UTC",
    });
    expect(free).toHaveLength(1);
    expect(free[0].start.toISOString()).toBe("2026-07-06T10:30:00.000Z");
    expect(free[0].end.toISOString()).toBe("2026-07-06T15:00:00.000Z");
  });

  it("drops slots shorter than minSlotMinutes", () => {
    const free = computeFreeSlots({
      from: new Date("2026-07-06T00:00:00Z"),
      to: new Date("2026-07-06T23:59:00Z"),
      workWindows: allDayWindows,
      // Leave only a 10-min gap (12:50–13:00) and the tail after 13:00.
      busy: [
        { start: new Date("2026-07-06T09:00:00Z"), end: new Date("2026-07-06T12:50:00Z") },
      ],
      tz: "UTC",
      minSlotMinutes: 30,
    });
    // 12:50–17:00 remains (> 30 min); nothing else qualifies.
    expect(free).toHaveLength(1);
    expect(free[0].start.toISOString()).toBe("2026-07-06T12:50:00.000Z");
  });

  it("computes total minutes across intervals", () => {
    const intervals: Interval[] = [
      { start: new Date("2026-07-06T09:00:00Z"), end: new Date("2026-07-06T10:00:00Z") },
      { start: new Date("2026-07-06T11:00:00Z"), end: new Date("2026-07-06T11:30:00Z") },
    ];
    expect(totalMinutes(intervals)).toBe(90);
  });
});

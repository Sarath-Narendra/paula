import { describe, it, expect } from "vitest";
import {
  computeConfidence,
  buildRecommendations,
} from "@/services/confidence";

describe("computeConfidence", () => {
  it("returns 100 when there is no remaining work", () => {
    const r = computeConfidence({
      requiredMinutes: 0,
      availableMinutes: 500,
      historicalCompletionRate: 0.5,
      procrastinationFactor: 0.5,
      calendarDensity: 0.5,
    });
    expect(r.confidence).toBe(100);
    expect(r.band).toBe("high");
  });

  it("is high when time is abundant and the user is reliable", () => {
    const r = computeConfidence({
      requiredMinutes: 200,
      availableMinutes: 400, // ratio 2.0
      historicalCompletionRate: 0.9,
      procrastinationFactor: 0.1,
      calendarDensity: 0.2,
    });
    expect(r.band).toBe("high");
    expect(r.confidence).toBeGreaterThanOrEqual(80);
  });

  it("is low when there is less time than required work", () => {
    const r = computeConfidence({
      requiredMinutes: 300,
      availableMinutes: 210, // ratio 0.7
      historicalCompletionRate: 0.6,
      procrastinationFactor: 0.5,
      calendarDensity: 0.6,
    });
    expect(r.band).toBe("low");
    expect(r.confidence).toBeLessThan(50);
  });

  it("monotonically increases as available time grows", () => {
    const base = {
      requiredMinutes: 200,
      historicalCompletionRate: 0.7,
      procrastinationFactor: 0.3,
      calendarDensity: 0.3,
    };
    const low = computeConfidence({ ...base, availableMinutes: 150 });
    const mid = computeConfidence({ ...base, availableMinutes: 250 });
    const high = computeConfidence({ ...base, availableMinutes: 400 });
    expect(low.confidence).toBeLessThan(mid.confidence);
    expect(mid.confidence).toBeLessThan(high.confidence);
  });

  it("caps confidence when subtasks could not be scheduled", () => {
    const r = computeConfidence({
      requiredMinutes: 200,
      availableMinutes: 1000, // would otherwise be very high
      historicalCompletionRate: 0.95,
      procrastinationFactor: 0.05,
      calendarDensity: 0.1,
      unscheduledRatio: 0.5,
    });
    expect(r.confidence).toBeLessThanOrEqual(20);
  });

  it("produces actionable recommendations only when shaky", () => {
    const good = computeConfidence({
      requiredMinutes: 100,
      availableMinutes: 300,
      historicalCompletionRate: 0.9,
      procrastinationFactor: 0.1,
      calendarDensity: 0.1,
    });
    expect(buildRecommendations(good, {
      requiredMinutes: 100,
      availableMinutes: 300,
      historicalCompletionRate: 0.9,
      procrastinationFactor: 0.1,
      calendarDensity: 0.1,
    })).toHaveLength(0);

    const shakyInput = {
      requiredMinutes: 300,
      availableMinutes: 240,
      historicalCompletionRate: 0.6,
      procrastinationFactor: 0.6,
      calendarDensity: 0.7,
    };
    const shaky = computeConfidence(shakyInput);
    const recs = buildRecommendations(shaky, shakyInput);
    expect(recs.length).toBeGreaterThan(0);
  });
});

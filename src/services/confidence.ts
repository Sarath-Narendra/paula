import type { Interval } from "@/lib/time";
import { totalMinutes } from "@/lib/time";

export interface ConfidenceInput {
  /** Remaining work minutes (Σ subtask estimates × personal effort multiplier). */
  requiredMinutes: number;
  /** Schedulable free minutes before the deadline (work hours only). */
  availableMinutes: number;
  /** Rolling on-time completion rate, 0–1. */
  historicalCompletionRate: number;
  /** Procrastination tendency, 0–1 (higher = worse). */
  procrastinationFactor: number;
  /** Fraction of work-window time already busy before the deadline, 0–1. */
  calendarDensity: number;
  /** Fraction of subtasks the scheduler could not place, 0–1. */
  unscheduledRatio?: number;
}

export type ConfidenceBand = "high" | "medium" | "low";

export interface ConfidenceResult {
  /** 0–100 probability of on-time completion. */
  confidence: number;
  band: ConfidenceBand;
  /** availableMinutes / requiredMinutes. */
  ratio: number;
  factors: {
    /** Time-headroom component (0–1). */
    time: number;
    /** Behavioral reliability component (0–1). */
    reliability: number;
  };
}

const logistic = (x: number) => 1 / (1 + Math.exp(-x));
const clamp = (x: number, lo: number, hi: number) =>
  Math.min(hi, Math.max(lo, x));

/**
 * Estimate the probability that a commitment will actually be completed on time.
 *
 * Two components:
 *  - time headroom: logistic curve on (available / required). ratio 1 → ~0.5,
 *    1.5 → ~0.8, 0.7 → ~0.3.
 *  - reliability: history, procrastination, and calendar density. Applied as a
 *    soft modifier (controls 40% of the score) so abundant time still reads high.
 *
 * Calibrated against solution.md's example bands (≈92% / ≈61% / ≈24%).
 */
export function computeConfidence(input: ConfidenceInput): ConfidenceResult {
  const required = Math.max(0, input.requiredMinutes);
  const available = Math.max(0, input.availableMinutes);

  // Nothing left to do → certain.
  if (required === 0) {
    return {
      confidence: 100,
      band: "high",
      ratio: Infinity,
      factors: { time: 1, reliability: 1 },
    };
  }

  const ratio = available / required;
  const timeComponent = logistic(2.8 * (ratio - 1));

  const reliability = clamp(
    clamp(input.historicalCompletionRate, 0, 1) *
      (1 - 0.5 * clamp(input.procrastinationFactor, 0, 1)) *
      (1 - 0.35 * clamp(input.calendarDensity, 0, 1)),
    0.05,
    1
  );

  let score = timeComponent * (0.6 + 0.4 * reliability);

  // Hard reality check: if the scheduler literally couldn't fit everything,
  // cap optimism proportionally.
  const unscheduled = clamp(input.unscheduledRatio ?? 0, 0, 1);
  if (unscheduled > 0) {
    score = Math.min(score, 0.4 * (1 - unscheduled));
  }

  const confidence = Math.round(clamp(score, 0, 1) * 100);
  const band: ConfidenceBand =
    confidence >= 75 ? "high" : confidence >= 50 ? "medium" : "low";

  return {
    confidence,
    band,
    ratio,
    factors: { time: timeComponent, reliability },
  };
}

/** Convenience: derive required/available minutes then compute confidence. */
export function computeConfidenceFromSlots(opts: {
  remainingSubtaskMinutes: number[];
  effortMultiplier: number;
  freeSlots: Interval[];
  workWindowMinutesBeforeDeadline: number;
  historicalCompletionRate: number;
  procrastinationFactor: number;
  unscheduledRatio?: number;
}): ConfidenceResult {
  const requiredMinutes =
    opts.remainingSubtaskMinutes.reduce((a, b) => a + b, 0) *
    opts.effortMultiplier;
  const availableMinutes = totalMinutes(opts.freeSlots);
  const busyMinutes = Math.max(
    0,
    opts.workWindowMinutesBeforeDeadline - availableMinutes
  );
  const calendarDensity =
    opts.workWindowMinutesBeforeDeadline > 0
      ? busyMinutes / opts.workWindowMinutesBeforeDeadline
      : 0;

  return computeConfidence({
    requiredMinutes,
    availableMinutes,
    historicalCompletionRate: opts.historicalCompletionRate,
    procrastinationFactor: opts.procrastinationFactor,
    calendarDensity,
    unscheduledRatio: opts.unscheduledRatio,
  });
}

export interface Recommendation {
  title: string;
  detail: string;
}

/**
 * Deterministic, rule-based recommendations for when confidence is shaky.
 * (Gemini narration can layer on top, but this guarantees useful output even
 * offline / without an API key.)
 */
export function buildRecommendations(
  result: ConfidenceResult,
  input: ConfidenceInput
): Recommendation[] {
  const recs: Recommendation[] = [];
  if (result.band === "high") return recs;

  if (result.ratio < 1.1) {
    recs.push({
      title: "Start earlier",
      detail:
        "There isn't much slack between now and the deadline. Begin the first subtask today rather than waiting.",
    });
    recs.push({
      title: "Reduce scope or extend the deadline",
      detail:
        "Trim non-essential steps, or push the deadline if you have any flexibility.",
    });
  }
  if ((input.calendarDensity ?? 0) > 0.5) {
    recs.push({
      title: "Clear lower-priority commitments",
      detail:
        "Your calendar is dense. Moving or declining one or two meetings frees up real working time.",
    });
  }
  if ((input.procrastinationFactor ?? 0) > 0.4) {
    recs.push({
      title: "Front-load the hard parts",
      detail:
        "Schedule the highest-effort subtask into your next peak-focus window so it doesn't slip.",
    });
  }
  if ((input.unscheduledRatio ?? 0) > 0) {
    recs.push({
      title: "Some work couldn't be scheduled",
      detail:
        "Not all subtasks fit before the deadline. Add a dedicated deep-work block or move the deadline.",
    });
  }
  if (recs.length === 0) {
    recs.push({
      title: "Add a buffer session",
      detail:
        "Confidence is moderate. A single extra focus block would meaningfully de-risk this plan.",
    });
  }
  return recs;
}

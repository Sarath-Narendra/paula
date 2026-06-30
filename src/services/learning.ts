import "server-only";
import { db, paths } from "@/lib/firestore";
import { getUser } from "@/services/users";
import { logActivity } from "@/services/tasks";
import type { UserProfile } from "@/lib/types";

const nowIso = () => new Date().toISOString();
const clamp = (x: number, lo: number, hi: number) =>
  Math.min(hi, Math.max(lo, x));

/** Exponential moving average. */
const ema = (prev: number, next: number, alpha: number) =>
  prev * (1 - alpha) + next * alpha;

/**
 * Learn from a completion: the user is reliable → nudge completion rate up and
 * procrastination down. Optionally record the hour as a productive hour.
 */
export async function learnFromCompletion(
  uid: string,
  completedAtHourMinutes?: number
): Promise<void> {
  const user = await getUser(uid);
  if (!user) return;

  const historicalCompletionRate = clamp(
    ema(user.historicalCompletionRate ?? 0.7, 1, 0.1),
    0,
    1
  );
  const procrastinationFactor = clamp(
    (user.procrastinationFactor ?? 0.3) * 0.95,
    0,
    1
  );

  // Reinforce the hour the user actually executed in as a preferred hour.
  let preferredHours = user.preferredHours ?? [];
  if (typeof completedAtHourMinutes === "number") {
    const hourSlot = Math.floor(completedAtHourMinutes / 60) * 60;
    if (!preferredHours.includes(hourSlot)) {
      preferredHours = [...preferredHours, hourSlot].slice(-6);
    }
  }

  await db()
    .doc(paths.user(uid))
    .set(
      {
        historicalCompletionRate,
        procrastinationFactor,
        preferredHours,
        updatedAt: nowIso(),
      },
      { merge: true }
    );
}

/** Learn from a miss: lower completion rate, raise procrastination estimate. */
export async function learnFromMiss(uid: string): Promise<void> {
  const user = await getUser(uid);
  if (!user) return;
  await db()
    .doc(paths.user(uid))
    .set(
      {
        historicalCompletionRate: clamp(
          ema(user.historicalCompletionRate ?? 0.7, 0, 0.15),
          0,
          1
        ),
        procrastinationFactor: clamp(
          (user.procrastinationFactor ?? 0.3) + 0.05,
          0,
          1
        ),
        updatedAt: nowIso(),
      },
      { merge: true }
    );
}

/**
 * Refine the personal effort multiplier from estimated vs actual minutes.
 * effortMultiplier > 1 means the user reliably takes longer than estimates.
 * Driven by real focus-session data (M7).
 */
export async function learnEffort(
  uid: string,
  estimatedMinutes: number,
  actualMinutes: number
): Promise<void> {
  if (estimatedMinutes <= 0 || actualMinutes <= 0) return;
  const user = await getUser(uid);
  if (!user) return;
  const ratio = actualMinutes / estimatedMinutes;
  const effortMultiplier = clamp(
    ema(user.effortMultiplier ?? 1, ratio, 0.2),
    0.5,
    2.5
  );
  await db()
    .doc(paths.user(uid))
    .set({ effortMultiplier, updatedAt: nowIso() }, { merge: true });

  if (Math.abs(effortMultiplier - (user.effortMultiplier ?? 1)) > 0.05) {
    await logActivity(uid, {
      kind: "learning",
      summary: "Paula refined your effort estimate",
      detail:
        effortMultiplier > 1.05
          ? `You tend to take ~${Math.round((effortMultiplier - 1) * 100)}% longer than planned — future schedules now account for that.`
          : `You tend to finish faster than planned — Paula tightened your schedules.`,
    });
  }
}

export interface LearningInsight {
  label: string;
  value: string;
}

/** Human-readable summary of what Paula has learned, for the UI. */
export function learningInsights(user: UserProfile): LearningInsight[] {
  const mult = user.effortMultiplier ?? 1;
  const rate = Math.round((user.historicalCompletionRate ?? 0.7) * 100);
  const peakHours = (user.preferredHours ?? [])
    .map((m) => Math.floor(m / 60))
    .sort((a, b) => a - b);
  const fmtHour = (h: number) => {
    const ampm = h < 12 ? "am" : "pm";
    const hour = h % 12 === 0 ? 12 : h % 12;
    return `${hour}${ampm}`;
  };

  return [
    {
      label: "Effort accuracy",
      value:
        mult > 1.05
          ? `Takes ${Math.round((mult - 1) * 100)}% longer than estimates`
          : mult < 0.95
            ? `Finishes ${Math.round((1 - mult) * 100)}% faster than estimates`
            : "Estimates are on point",
    },
    { label: "Reliability", value: `${rate}% on-time completion` },
    {
      label: "Peak focus hours",
      value: peakHours.length
        ? peakHours.map(fmtHour).join(", ")
        : "Still learning",
    },
  ];
}

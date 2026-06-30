import "server-only";
import { formatInTimeZone } from "date-fns-tz";
import { subDays } from "date-fns";
import { db, paths } from "@/lib/firestore";
import { getUser, adjustCredits } from "@/services/users";
import {
  learnFromCompletion,
  learnFromMiss,
  learnEffort,
} from "@/services/learning";
import {
  getTask,
  listSubtasks,
  updateSubtask,
  updateBlock,
  updateTask,
  logActivity,
} from "@/services/tasks";
import type { Subtask, UserProfile } from "@/lib/types";

const nowIso = () => new Date().toISOString();

/** Credits earned for finishing a subtask, scaled by difficulty & energy. */
function creditsForSubtask(s: Subtask): number {
  const energyBonus = s.energy === "high" ? 5 : s.energy === "medium" ? 2 : 0;
  return 10 + s.difficulty * 2 + energyBonus;
}

const TASK_COMPLETE_BONUS = 25;
const MISS_PENALTY = 5;

/** Compute the new streak given the user's timezone and last active day. */
function nextStreak(user: UserProfile, now: Date): { streak: number; day: string } {
  const tz = user.timezone || "UTC";
  const today = formatInTimeZone(now, tz, "yyyy-MM-dd");
  const yesterday = formatInTimeZone(subDays(now, 1), tz, "yyyy-MM-dd");
  if (user.lastActiveDay === today) return { streak: user.streak || 0, day: today };
  if (user.lastActiveDay === yesterday)
    return { streak: (user.streak || 0) + 1, day: today };
  return { streak: 1, day: today };
}

export interface CompletionResult {
  creditsAwarded: number;
  totalCredits: number;
  streak: number;
  taskCompleted: boolean;
}

/**
 * Mark a subtask done: award credits, advance the streak, complete its block,
 * and finish the parent task if everything is done.
 */
export async function completeSubtask(
  uid: string,
  taskId: string,
  subtaskId: string,
  opts: { actualMinutes?: number } = {}
): Promise<CompletionResult | null> {
  const user = await getUser(uid);
  if (!user) return null;
  const subtasks = await listSubtasks(uid, taskId);
  const subtask = subtasks.find((s) => s.id === subtaskId);
  if (!subtask || subtask.status === "done") return null;

  const now = new Date();
  let credits = creditsForSubtask(subtask);

  // Record actual duration — real elapsed time from a focus session if given,
  // otherwise fall back to the estimate.
  const actualDuration = opts.actualMinutes ?? subtask.estDuration;
  await updateSubtask(uid, taskId, subtaskId, {
    status: "done",
    actualDuration,
  });
  if (subtask.scheduledBlockId) {
    await updateBlock(uid, subtask.scheduledBlockId, { status: "completed" });
  }

  // Did this finish the whole task?
  const remaining = subtasks.filter(
    (s) => s.id !== subtaskId && s.status !== "done"
  );
  const taskCompleted = remaining.length === 0;

  const { streak, day } = nextStreak(user, now);
  let tasksCompleted = user.tasksCompleted ?? 0;
  if (taskCompleted) {
    credits += TASK_COMPLETE_BONUS;
    tasksCompleted += 1;
    await updateTask(uid, taskId, { status: "completed" });
  }

  const totalCredits = Math.max(0, (user.credits ?? 0) + credits);
  await db()
    .doc(paths.user(uid))
    .set(
      {
        credits: totalCredits,
        streak,
        lastActiveDay: day,
        subtasksCompleted: (user.subtasksCompleted ?? 0) + 1,
        tasksCompleted,
        updatedAt: nowIso(),
      },
      { merge: true }
    );

  // Learn from this completion (reliability up; reinforce this productive hour).
  const tz = user.timezone || "UTC";
  const hourMinutes = Number(formatInTimeZone(now, tz, "H")) * 60;
  await learnFromCompletion(uid, hourMinutes);
  // If we have real elapsed time, refine the effort multiplier.
  if (opts.actualMinutes) {
    await learnEffort(uid, subtask.estDuration, opts.actualMinutes);
  }

  const task = await getTask(uid, taskId);
  await logActivity(uid, {
    kind: "gamification",
    summary: taskCompleted
      ? `Completed “${task?.title ?? "task"}” · +${credits} credits`
      : `Finished “${subtask.title}” · +${credits} credits`,
    detail: `${streak}-day streak · ${totalCredits} credits total.`,
  });

  return { creditsAwarded: credits, totalCredits, streak, taskCompleted };
}

/** Deduct credits for missed work sessions (called during replan). */
export async function applyMissPenalty(
  uid: string,
  count: number
): Promise<void> {
  if (count <= 0) return;
  const user = await getUser(uid);
  if (!user) return;
  const penalty = count * MISS_PENALTY;
  const totalCredits = Math.max(0, (user.credits ?? 0) - penalty);
  await db()
    .doc(paths.user(uid))
    .set({ credits: totalCredits, streak: 0, updatedAt: nowIso() }, { merge: true });
  await learnFromMiss(uid);
  await logActivity(uid, {
    kind: "gamification",
    summary: `Missed ${count} session${count > 1 ? "s" : ""} · −${penalty} credits`,
    detail: "Streak reset. Paula rescheduled the work — jump back in.",
  });
}

/**
 * Record a completed focus session. Awards credits scaled by focused minutes
 * and reduced by distractions (tab-switches), and reinforces the productive
 * hour in the learning model.
 */
export async function recordFocusSession(
  uid: string,
  opts: { minutes: number; distractions: number }
): Promise<{ credits: number }> {
  const user = await getUser(uid);
  const credits = Math.max(
    1,
    Math.min(60, Math.round(opts.minutes / 5) - opts.distractions * 2)
  );
  await adjustCredits(uid, credits);

  if (user) {
    const tz = user.timezone || "UTC";
    const hourMinutes = Number(formatInTimeZone(new Date(), tz, "H")) * 60;
    await learnFromCompletion(uid, hourMinutes);
  }
  await logActivity(uid, {
    kind: "gamification",
    summary: `Focused for ${Math.round(opts.minutes)} min · +${credits} credits`,
    detail:
      opts.distractions > 0
        ? `${opts.distractions} distraction${opts.distractions > 1 ? "s" : ""} cost you some credits.`
        : "Zero distractions — full reward.",
  });
  return { credits };
}

export interface Achievement {
  id: string;
  label: string;
  description: string;
  unlocked: boolean;
}

/** Derive achievements from a user's stored stats (no extra storage needed). */
export function deriveAchievements(user: UserProfile): Achievement[] {
  const credits = user.credits ?? 0;
  const streak = user.streak ?? 0;
  const tasks = user.tasksCompleted ?? 0;
  const subs = user.subtasksCompleted ?? 0;
  return [
    {
      id: "first-step",
      label: "First Step",
      description: "Complete your first subtask",
      unlocked: subs >= 1,
    },
    {
      id: "finisher",
      label: "Finisher",
      description: "Complete a full task",
      unlocked: tasks >= 1,
    },
    {
      id: "streak-3",
      label: "On a Roll",
      description: "Reach a 3-day streak",
      unlocked: streak >= 3,
    },
    {
      id: "streak-7",
      label: "Unstoppable",
      description: "Reach a 7-day streak",
      unlocked: streak >= 7,
    },
    {
      id: "century",
      label: "Century",
      description: "Earn 100 credits",
      unlocked: credits >= 100,
    },
    {
      id: "machine",
      label: "Execution Machine",
      description: "Complete 10 tasks",
      unlocked: tasks >= 10,
    },
  ];
}

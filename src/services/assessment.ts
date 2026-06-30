import "server-only";
import type { OAuthClient } from "@/lib/google";
import { getBusyIntervals } from "@/lib/calendar";
import { computeFreeSlots, totalMinutes, type Interval } from "@/lib/time";
import {
  computeConfidence,
  buildRecommendations,
  type ConfidenceInput,
  type ConfidenceResult,
  type Recommendation,
} from "@/services/confidence";
import { generateText } from "@/lib/gemini";
import { getUser } from "@/services/users";
import {
  getTask,
  listSubtasks,
  listBlocksForTask,
  updateTask,
} from "@/services/tasks";
import type { Task } from "@/lib/types";

export interface TaskAssessment {
  task: Task;
  result: ConfidenceResult;
  recommendations: Recommendation[];
  /** One-line natural-language read on the plan (Gemini, optional). */
  narration?: string;
}

/**
 * Recompute a task's commitment confidence against the user's *current*
 * calendar, generate recommendations, and persist the score.
 */
export async function assessTask(
  uid: string,
  client: OAuthClient | null,
  taskId: string,
  options: { narrate?: boolean } = {}
): Promise<TaskAssessment | null> {
  const task = await getTask(uid, taskId);
  if (!task) return null;
  const user = await getUser(uid);
  if (!user) return null;

  const subtasks = await listSubtasks(uid, taskId);
  const blocks = await listBlocksForTask(uid, taskId);
  const now = new Date();
  const deadline = new Date(task.deadline);

  const remaining = subtasks.filter((s) => s.status !== "done");
  const requiredMinutes =
    remaining.reduce((a, s) => a + s.estDuration, 0) * user.effortMultiplier;

  let busy: Interval[] = [];
  if (client && deadline > now) {
    const raw = await getBusyIntervals(
      client,
      now.toISOString(),
      deadline.toISOString()
    );
    busy = raw.map((b) => ({ start: new Date(b.start), end: new Date(b.end) }));
  }

  const freeSlots =
    deadline > now
      ? computeFreeSlots({
          from: now,
          to: deadline,
          workWindows: user.workWindows,
          busy,
          tz: user.timezone,
          minSlotMinutes: 15,
        })
      : [];
  const availableMinutes = totalMinutes(freeSlots);

  const workWindowMinutes =
    deadline > now
      ? totalMinutes(
          computeFreeSlots({
            from: now,
            to: deadline,
            workWindows: user.workWindows,
            busy: [],
            tz: user.timezone,
            minSlotMinutes: 0,
          })
        )
      : 0;

  const scheduledSubtaskIds = new Set(
    blocks.filter((b) => b.type === "work").map((b) => b.subtaskId)
  );
  const unscheduledRatio = remaining.length
    ? remaining.filter((s) => !scheduledSubtaskIds.has(s.id)).length /
      remaining.length
    : 0;

  const input: ConfidenceInput = {
    requiredMinutes,
    availableMinutes,
    historicalCompletionRate: user.historicalCompletionRate,
    procrastinationFactor: user.procrastinationFactor,
    calendarDensity:
      workWindowMinutes > 0
        ? Math.max(0, workWindowMinutes - availableMinutes) / workWindowMinutes
        : 0,
    unscheduledRatio,
  };

  const result = computeConfidence(input);
  const recommendations = buildRecommendations(result, input);

  // Persist the latest score.
  if (result.confidence !== task.confidence) {
    await updateTask(uid, taskId, { confidence: result.confidence });
  }

  let narration: string | undefined;
  if (options.narrate) {
    try {
      narration = await generateText({
        system:
          "You are Paula, an execution advisor. Given a confidence assessment, write ONE short, specific sentence (max 30 words) telling the user whether their plan is realistic and the single most useful next move. No preamble.",
        prompt: `Task: "${task.title}". Deadline: ${task.deadline}. Confidence: ${result.confidence}% (band: ${result.band}). Required work: ${Math.round(requiredMinutes)} min. Available time: ${Math.round(availableMinutes)} min.`,
      });
    } catch {
      // Gemini optional — recommendations already cover the offline case.
    }
  }

  return { task: { ...task, confidence: result.confidence }, result, recommendations, narration };
}

import "server-only";
import { randomUUID } from "crypto";
import type { OAuthClient } from "@/lib/google";
import { getBusyIntervals, createEvent, deleteEvent } from "@/lib/calendar";
import { computeFreeSlots, totalMinutes, type Interval } from "@/lib/time";
import { packSubtasks, type SchedulableSubtask } from "@/services/scheduler";
import { decomposeGoal } from "@/services/decompose";
import { computeConfidenceFromSlots } from "@/services/confidence";
import { applyMissPenalty } from "@/services/gamification";
import { generateRemindersForUser } from "@/services/reminders";
import { getUser } from "@/services/users";
import {
  createTask,
  updateTask,
  saveSubtasks,
  replaceBlocksForTask,
  listTasks,
  listSubtasks,
  listBlocksForTask,
  logActivity,
} from "@/services/tasks";
import type {
  Difficulty,
  Importance,
  ScheduleBlock,
  Subtask,
  Task,
  UserProfile,
} from "@/lib/types";

// Google Calendar colorIds: work = blueberry, recovery = sage.
const COLOR_WORK = "9";
const COLOR_RECOVERY = "2";

export interface CreatePlanInput {
  goal: string;
  deadline: string; // ISO
  importance: Importance;
}

export interface CreatePlanResult {
  taskId: string;
  title: string;
  summary: string;
  scheduledCount: number;
  unscheduledCount: number;
  confidence: number;
}

/**
 * Build schedule blocks (work + recovery) for a set of subtasks against the
 * user's real calendar, and create the corresponding Google Calendar events.
 * Shared by initial planning and (later) rescheduling.
 */
export async function scheduleSubtasks(opts: {
  uid: string;
  taskId: string;
  taskTitle: string;
  client: OAuthClient | null;
  user: UserProfile;
  subtasks: Subtask[];
  from: Date;
  to: Date;
}): Promise<{
  blocks: ScheduleBlock[];
  unscheduled: string[];
  freeSlots: Interval[];
  workWindowMinutes: number;
}> {
  const { uid, taskId, taskTitle, client, user, subtasks, from, to } = opts;

  // Real commitments from Google Calendar (empty if not connected).
  let busy: Interval[] = [];
  if (client) {
    const raw = await getBusyIntervals(client, from.toISOString(), to.toISOString());
    busy = raw.map((b) => ({ start: new Date(b.start), end: new Date(b.end) }));
  }

  const free = computeFreeSlots({
    from,
    to,
    workWindows: user.workWindows,
    busy,
    tz: user.timezone,
    minSlotMinutes: 15,
  });

  // Total work-window capacity ignoring busy time → used for calendar density.
  const workWindowMinutes = totalMinutes(
    computeFreeSlots({
      from,
      to,
      workWindows: user.workWindows,
      busy: [],
      tz: user.timezone,
      minSlotMinutes: 0,
    })
  );

  const sched: SchedulableSubtask[] = subtasks.map((s) => ({
    id: s.id,
    minutes: Math.max(5, Math.round(s.estDuration * user.effortMultiplier)),
    deps: s.deps,
    energy: s.energy,
    order: s.order,
  }));

  const packed = packSubtasks(free, sched, {
    earliest: from,
    recoveryAfterMinutes: 50,
    recoveryMinutes: 10,
    preferredHours: user.preferredHours.map((m) => Math.floor(m / 60)),
    tz: user.timezone,
  });

  const titleById = new Map(subtasks.map((s) => [s.id, s.title]));
  const blocks: ScheduleBlock[] = [];

  for (const p of packed.placements) {
    const subtaskTitle = titleById.get(p.subtaskId) ?? "Work";
    let gcalEventId: string | undefined;
    if (client) {
      gcalEventId = await createEvent(client, {
        summary: `▣ ${subtaskTitle}`,
        description: `Paula • ${taskTitle}`,
        start: p.start.toISOString(),
        end: p.end.toISOString(),
        colorId: COLOR_WORK,
      });
    }
    blocks.push({
      id: randomUUID(),
      uid,
      taskId,
      subtaskId: p.subtaskId,
      title: subtaskTitle,
      start: p.start.toISOString(),
      end: p.end.toISOString(),
      type: "work",
      status: "scheduled",
      gcalEventId,
    });
  }

  for (const r of packed.recovery) {
    let gcalEventId: string | undefined;
    if (client) {
      gcalEventId = await createEvent(client, {
        summary: "☕ Recovery break",
        description: `Paula • ${taskTitle}`,
        start: r.start.toISOString(),
        end: r.end.toISOString(),
        colorId: COLOR_RECOVERY,
      });
    }
    blocks.push({
      id: randomUUID(),
      uid,
      taskId,
      subtaskId: "",
      title: "Recovery break",
      start: r.start.toISOString(),
      end: r.end.toISOString(),
      type: "recovery",
      status: "scheduled",
      gcalEventId,
    });
  }

  return {
    blocks,
    unscheduled: packed.unscheduled,
    freeSlots: free,
    workWindowMinutes,
  };
}

/**
 * Full create-plan pipeline:
 * decompose (Gemini) → schedule (deterministic) → persist + write to Calendar.
 */
export async function createPlan(
  uid: string,
  client: OAuthClient | null,
  input: CreatePlanInput
): Promise<CreatePlanResult> {
  const user = await getUser(uid);
  if (!user) throw new Error("User profile not found");

  const now = new Date();
  const decomp = await decomposeGoal({
    goal: input.goal,
    deadlineIso: input.deadline,
    nowIso: now.toISOString(),
    importance: input.importance,
  });

  // Materialize subtasks with stable ids; map dependency indices → ids.
  const ids = decomp.subtasks.map(() => randomUUID());
  const subtasks: Subtask[] = decomp.subtasks.map((s, i) => ({
    id: ids[i],
    title: s.title,
    estDuration: s.estDuration,
    difficulty: s.difficulty as Difficulty,
    energy: s.energy,
    deps: (s.deps ?? [])
      .filter((idx) => idx >= 0 && idx < ids.length && idx !== i)
      .map((idx) => ids[idx]),
    status: "pending",
    order: i,
  }));

  const title = decomp.title?.trim() || input.goal.slice(0, 60);
  const taskId = await createTask(uid, {
    title,
    goal: input.goal,
    deadline: input.deadline,
    importance: input.importance,
  });

  const { blocks, unscheduled, freeSlots, workWindowMinutes } =
    await scheduleSubtasks({
      uid,
      taskId,
      taskTitle: title,
      client,
      user,
      subtasks,
      from: now,
      to: new Date(input.deadline),
    });

  // Mark scheduled subtasks.
  const scheduledIds = new Set(
    blocks.filter((b) => b.type === "work").map((b) => b.subtaskId)
  );
  for (const s of subtasks) {
    if (scheduledIds.has(s.id)) {
      s.status = "scheduled";
      s.scheduledBlockId = blocks.find(
        (b) => b.subtaskId === s.id
      )?.id;
    }
  }

  // Commitment Confidence: how likely is this plan to actually succeed?
  const confidence = computeConfidenceFromSlots({
    remainingSubtaskMinutes: subtasks.map((s) => s.estDuration),
    effortMultiplier: user.effortMultiplier,
    freeSlots,
    workWindowMinutesBeforeDeadline: workWindowMinutes,
    historicalCompletionRate: user.historicalCompletionRate,
    procrastinationFactor: user.procrastinationFactor,
    unscheduledRatio: subtasks.length ? unscheduled.length / subtasks.length : 0,
  });

  await saveSubtasks(uid, taskId, subtasks);
  await replaceBlocksForTask(uid, taskId, blocks);
  await updateTask(uid, taskId, { confidence: confidence.confidence });
  await generateRemindersForUser(uid);

  await logActivity(uid, {
    kind: "plan",
    summary: `Planned “${title}” · ${confidence.confidence}% confidence`,
    detail: `${subtasks.length} subtasks, ${scheduledIds.size} scheduled${
      unscheduled.length ? `, ${unscheduled.length} couldn't fit before the deadline` : ""
    }.`,
  });

  return {
    taskId,
    title,
    summary: decomp.summary,
    scheduledCount: scheduledIds.size,
    unscheduledCount: unscheduled.length,
    confidence: confidence.confidence,
  };
}

// ---- Dynamic rescheduling (the "living schedule") ----

export interface RescheduleSummary {
  taskId: string;
  title: string;
  /** Work blocks that were (re)placed. */
  rescheduledCount: number;
  /** Past work sessions that were missed and recovered into the future. */
  missedCount: number;
  unscheduledCount: number;
  confidence: number;
  changed: boolean;
}

/**
 * Rebuild a single task's schedule against the user's *current* calendar.
 * Completed work is preserved; everything not-yet-done is re-placed, which
 * naturally resolves new meetings, missed sessions, and overruns.
 */
export async function reschedulePlan(opts: {
  uid: string;
  client: OAuthClient | null;
  task: Task;
  user: UserProfile;
  reason: string;
}): Promise<RescheduleSummary | null> {
  const { uid, client, task, user, reason } = opts;
  const now = new Date();
  const deadline = new Date(task.deadline);

  const subtasks = await listSubtasks(uid, task.id);
  const blocks = await listBlocksForTask(uid, task.id);

  const toSchedule = subtasks.filter((s) => s.status !== "done");
  if (toSchedule.length === 0) return null;

  // Count missed work sessions (scheduled in the past, never completed).
  const missedCount = blocks.filter(
    (b) => b.type === "work" && b.status === "scheduled" && new Date(b.end) < now
  ).length;

  // Remove all non-completed Paula events from the calendar before rebuilding,
  // so freebusy reflects only real commitments (no self-conflict).
  const completedBlocks = blocks.filter((b) => b.status === "completed");
  if (client) {
    for (const b of blocks) {
      if (b.status !== "completed" && b.gcalEventId) {
        await deleteEvent(client, b.gcalEventId);
      }
    }
  }

  const { blocks: newBlocks, unscheduled, freeSlots, workWindowMinutes } =
    await scheduleSubtasks({
      uid,
      taskId: task.id,
      taskTitle: task.title,
      client,
      user,
      subtasks: toSchedule,
      from: now,
      to: deadline,
    });

  // Update subtask statuses for the rescheduled set.
  const scheduledIds = new Set(
    newBlocks.filter((b) => b.type === "work").map((b) => b.subtaskId)
  );
  for (const s of toSchedule) {
    s.status = scheduledIds.has(s.id) ? "scheduled" : "pending";
    s.scheduledBlockId = newBlocks.find((b) => b.subtaskId === s.id)?.id;
  }
  await saveSubtasks(uid, task.id, toSchedule);

  // Preserve completed history; replace everything else.
  await replaceBlocksForTask(uid, task.id, [...completedBlocks, ...newBlocks]);

  const confidence = computeConfidenceFromSlots({
    remainingSubtaskMinutes: toSchedule.map((s) => s.estDuration),
    effortMultiplier: user.effortMultiplier,
    freeSlots,
    workWindowMinutesBeforeDeadline: workWindowMinutes,
    historicalCompletionRate: user.historicalCompletionRate,
    procrastinationFactor: user.procrastinationFactor,
    unscheduledRatio: toSchedule.length
      ? unscheduled.length / toSchedule.length
      : 0,
  });

  const patch: Partial<Task> = { confidence: confidence.confidence };
  if (missedCount > 0) {
    patch.postponementCount = (task.postponementCount ?? 0) + missedCount;
  }
  await updateTask(uid, task.id, patch);

  // Missed commitments cost credits and reset the streak.
  if (missedCount > 0) {
    await applyMissPenalty(uid, missedCount);
  }

  const rescheduledCount = newBlocks.filter((b) => b.type === "work").length;
  const changed = missedCount > 0 || rescheduledCount > 0;

  if (changed) {
    const bits: string[] = [];
    if (missedCount > 0)
      bits.push(`recovered ${missedCount} missed session${missedCount > 1 ? "s" : ""}`);
    bits.push(`re-placed ${rescheduledCount} block${rescheduledCount > 1 ? "s" : ""}`);
    if (unscheduled.length)
      bits.push(`${unscheduled.length} still won't fit`);
    await logActivity(uid, {
      kind: "reschedule",
      summary: `Rescheduled “${task.title}” (${reason})`,
      detail: `${bits.join(", ")}. Confidence now ${confidence.confidence}%.`,
    });
  }

  return {
    taskId: task.id,
    title: task.title,
    rescheduledCount,
    missedCount,
    unscheduledCount: unscheduled.length,
    confidence: confidence.confidence,
    changed,
  };
}

/** Re-plan every active task for a user. Used by manual trigger and cron. */
export async function replanUser(
  uid: string,
  client: OAuthClient | null,
  reason: string
): Promise<RescheduleSummary[]> {
  const user = await getUser(uid);
  if (!user) return [];
  const tasks = (await listTasks(uid)).filter((t) => t.status === "active");
  const summaries: RescheduleSummary[] = [];
  for (const task of tasks) {
    try {
      const summary = await reschedulePlan({ uid, client, task, user, reason });
      if (summary) summaries.push(summary);
    } catch (err) {
      console.error(`[replan] task ${task.id} failed`, err);
    }
  }
  // Refresh reminders against the updated schedule.
  await generateRemindersForUser(uid);
  return summaries;
}

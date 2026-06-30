/**
 * Core domain types for Paula — the autonomous execution planner.
 * These mirror the Firestore data model documented in the build plan.
 */

export type ISODateString = string; // e.g. "2026-06-28T14:30:00.000Z"

export type Chronotype = "early_bird" | "intermediate" | "night_owl";

export type TaskStatus = "active" | "completed" | "archived";
export type SubtaskStatus = "pending" | "scheduled" | "in_progress" | "done" | "skipped";
export type BlockType = "work" | "recovery";
export type BlockStatus = "scheduled" | "completed" | "missed";
export type Importance = 1 | 2 | 3 | 4 | 5; // 5 = critical
export type Difficulty = 1 | 2 | 3 | 4 | 5;
export type EnergyLevel = "low" | "medium" | "high";

/** A user's working-hours window for a single day (minutes from midnight, local). */
export interface WorkWindow {
  /** 0 = Sunday … 6 = Saturday */
  weekday: number;
  startMinute: number; // e.g. 540 = 09:00
  endMinute: number; // e.g. 1080 = 18:00
}

export interface UserProfile {
  uid: string;
  email: string;
  name?: string;
  image?: string;
  timezone: string; // IANA, e.g. "Asia/Kolkata"
  chronotype: Chronotype;
  workWindows: WorkWindow[];
  /** Learned multiplier applied to AI effort estimates (1.0 = accurate). */
  effortMultiplier: number;
  /** Learned peak-focus hours (minutes from midnight). */
  preferredHours: number[];
  /** Rolling completion rate in [0,1], used by the confidence engine. */
  historicalCompletionRate: number;
  /** Tendency to delay, in [0,1]; higher = more procrastination. */
  procrastinationFactor: number;
  credits: number;
  streak: number;
  /** Local day (yyyy-MM-dd) of the last completion, for streak tracking. */
  lastActiveDay?: string;
  subtasksCompleted: number;
  tasksCompleted: number;
  createdAt: ISODateString;
  updatedAt: ISODateString;
}

export interface Subtask {
  id: string;
  title: string;
  /** AI effort estimate in minutes (before personal multiplier). */
  estDuration: number;
  /** Recorded actual minutes once completed (for the learning system). */
  actualDuration?: number;
  difficulty: Difficulty;
  energy: EnergyLevel;
  /** Subtask ids that must be done before this one can start. */
  deps: string[];
  status: SubtaskStatus;
  scheduledBlockId?: string;
  order: number;
}

export interface Task {
  id: string;
  uid: string;
  title: string;
  /** The raw goal the user expressed, e.g. "Finish OS assignment by Friday". */
  goal: string;
  deadline: ISODateString;
  importance: Importance;
  status: TaskStatus;
  /** 0–100 probability of on-time completion, from the confidence engine. */
  confidence?: number;
  /** Continuous priority score; higher = do sooner. */
  executionScore?: number;
  /** How many times scheduled blocks for this task have slipped. */
  postponementCount: number;
  createdAt: ISODateString;
  updatedAt: ISODateString;
}

/** A subtask is a child document; this convenience type bundles them. */
export interface TaskWithSubtasks extends Task {
  subtasks: Subtask[];
}

export interface ScheduleBlock {
  id: string;
  uid: string;
  taskId: string;
  subtaskId: string;
  title: string;
  start: ISODateString;
  end: ISODateString;
  type: BlockType;
  status: BlockStatus;
  /** Google Calendar event id, once synced. */
  gcalEventId?: string;
}

/** A busy interval imported from Google Calendar (fixed commitment). */
export interface BusyEvent {
  id: string;
  uid: string;
  summary?: string;
  start: ISODateString;
  end: ISODateString;
  source: "google";
  gcalEventId: string;
}

export type ReminderEscalation = 0 | 1 | 2 | 3;

export interface Reminder {
  id: string;
  uid: string;
  taskId?: string;
  blockId?: string;
  message: string;
  /** When Paula intends to surface this, chosen for context (after meeting, etc.). */
  deliverAt: ISODateString;
  context: string; // e.g. "after_current_block", "before_sleep"
  escalationLevel: ReminderEscalation;
  delivered: boolean;
  acknowledged: boolean;
  createdAt: ISODateString;
}

/** An entry in the activity feed explaining an autonomous action Paula took. */
export interface ActivityEntry {
  id: string;
  uid: string;
  kind: "plan" | "reschedule" | "reminder" | "confidence" | "gamification" | "learning";
  summary: string;
  detail?: string;
  createdAt: ISODateString;
}

export interface Space {
  id: string;
  name: string;
  ownerUid: string;
  memberUids: string[];
  createdAt: ISODateString;
}

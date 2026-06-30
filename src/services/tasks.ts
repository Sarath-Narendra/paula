import "server-only";
import { randomUUID } from "crypto";
import { db, paths } from "@/lib/firestore";
import type {
  ActivityEntry,
  ScheduleBlock,
  Subtask,
  Task,
  TaskWithSubtasks,
} from "@/lib/types";

const nowIso = () => new Date().toISOString();

// ---- Tasks ----

export async function createTask(
  uid: string,
  input: Pick<Task, "title" | "goal" | "deadline" | "importance">
): Promise<string> {
  const id = randomUUID();
  const task: Task = {
    id,
    uid,
    title: input.title,
    goal: input.goal,
    deadline: input.deadline,
    importance: input.importance,
    status: "active",
    postponementCount: 0,
    createdAt: nowIso(),
    updatedAt: nowIso(),
  };
  await db().doc(paths.task(uid, id)).set(task);
  return id;
}

export async function updateTask(
  uid: string,
  taskId: string,
  patch: Partial<Task>
): Promise<void> {
  await db()
    .doc(paths.task(uid, taskId))
    .set({ ...patch, updatedAt: nowIso() }, { merge: true });
}

export async function getTask(
  uid: string,
  taskId: string
): Promise<Task | null> {
  const snap = await db().doc(paths.task(uid, taskId)).get();
  return snap.exists ? (snap.data() as Task) : null;
}

export async function listTasks(uid: string): Promise<Task[]> {
  const snap = await db()
    .collection(paths.tasks(uid))
    .orderBy("createdAt", "desc")
    .get();
  return snap.docs.map((d) => d.data() as Task);
}

// ---- Subtasks ----

export async function saveSubtasks(
  uid: string,
  taskId: string,
  subtasks: Subtask[]
): Promise<void> {
  const batch = db().batch();
  const col = db().collection(paths.subtasks(uid, taskId));
  for (const s of subtasks) {
    batch.set(col.doc(s.id), s);
  }
  await batch.commit();
}

export async function listSubtasks(
  uid: string,
  taskId: string
): Promise<Subtask[]> {
  const snap = await db()
    .collection(paths.subtasks(uid, taskId))
    .orderBy("order", "asc")
    .get();
  return snap.docs.map((d) => d.data() as Subtask);
}

export async function updateSubtask(
  uid: string,
  taskId: string,
  subtaskId: string,
  patch: Partial<Subtask>
): Promise<void> {
  await db()
    .doc(`${paths.subtasks(uid, taskId)}/${subtaskId}`)
    .set(patch, { merge: true });
}

export async function getTaskWithSubtasks(
  uid: string,
  taskId: string
): Promise<TaskWithSubtasks | null> {
  const task = await getTask(uid, taskId);
  if (!task) return null;
  const subtasks = await listSubtasks(uid, taskId);
  return { ...task, subtasks };
}

// ---- Blocks ----

export async function listBlocks(uid: string): Promise<ScheduleBlock[]> {
  const snap = await db()
    .collection(paths.blocks(uid))
    .orderBy("start", "asc")
    .get();
  return snap.docs.map((d) => d.data() as ScheduleBlock);
}

export async function listBlocksForTask(
  uid: string,
  taskId: string
): Promise<ScheduleBlock[]> {
  const snap = await db()
    .collection(paths.blocks(uid))
    .where("taskId", "==", taskId)
    .get();
  return snap.docs.map((d) => d.data() as ScheduleBlock);
}

/** Delete all existing blocks for a task and write the new set. */
export async function replaceBlocksForTask(
  uid: string,
  taskId: string,
  blocks: ScheduleBlock[]
): Promise<void> {
  const existing = await db()
    .collection(paths.blocks(uid))
    .where("taskId", "==", taskId)
    .get();
  const batch = db().batch();
  existing.docs.forEach((d) => batch.delete(d.ref));
  const col = db().collection(paths.blocks(uid));
  for (const b of blocks) batch.set(col.doc(b.id), b);
  await batch.commit();
}

export async function updateBlock(
  uid: string,
  blockId: string,
  patch: Partial<ScheduleBlock>
): Promise<void> {
  await db().doc(`${paths.blocks(uid)}/${blockId}`).set(patch, { merge: true });
}

// ---- Activity feed ----

export async function logActivity(
  uid: string,
  entry: Omit<ActivityEntry, "id" | "uid" | "createdAt">
): Promise<void> {
  const id = randomUUID();
  const full: ActivityEntry = { id, uid, createdAt: nowIso(), ...entry };
  await db().doc(`${paths.activity(uid)}/${id}`).set(full);
}

export async function listActivity(
  uid: string,
  limit = 30
): Promise<ActivityEntry[]> {
  const snap = await db()
    .collection(paths.activity(uid))
    .orderBy("createdAt", "desc")
    .limit(limit)
    .get();
  return snap.docs.map((d) => d.data() as ActivityEntry);
}

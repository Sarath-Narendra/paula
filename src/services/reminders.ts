import "server-only";
import { randomUUID } from "crypto";
import { FieldValue } from "firebase-admin/firestore";
import { db, paths } from "@/lib/firestore";
import { listBlocks } from "@/services/tasks";
import type { Reminder } from "@/lib/types";

const nowIso = () => new Date().toISOString();

/** Lead time before a block that Paula nudges the user. */
const LEAD_MINUTES = 10;

function contextFor(start: Date): string {
  const h = start.getHours();
  if (h < 12) return "this morning";
  if (h < 17) return "this afternoon";
  return "this evening";
}

/**
 * (Re)generate context-aware reminders from the user's upcoming work blocks.
 * Clears unacknowledged reminders first so the set always reflects the current
 * (living) schedule. Called after every plan / replan.
 */
export async function generateRemindersForUser(uid: string): Promise<void> {
  const now = new Date();
  const upcoming = (await listBlocks(uid))
    .filter((b) => b.type === "work" && new Date(b.start) > now)
    .slice(0, 6);

  // Remove existing unacknowledged reminders (keep acknowledged history).
  const existing = await db()
    .collection(paths.reminders(uid))
    .where("acknowledged", "==", false)
    .get();
  const batch = db().batch();
  existing.docs.forEach((d) => batch.delete(d.ref));

  const col = db().collection(paths.reminders(uid));
  for (const block of upcoming) {
    const start = new Date(block.start);
    const deliverAt = new Date(start.getTime() - LEAD_MINUTES * 60_000);
    const id = randomUUID();
    const reminder: Reminder = {
      id,
      uid,
      blockId: block.id,
      message: `Time to focus on “${block.title}” ${contextFor(start)}.`,
      deliverAt: deliverAt.toISOString(),
      context: "before_block",
      escalationLevel: 0,
      delivered: false,
      acknowledged: false,
      createdAt: nowIso(),
    };
    batch.set(col.doc(id), reminder);
  }
  await batch.commit();
}

/** Reminders the user hasn't dismissed yet, soonest first. */
export async function listReminders(uid: string): Promise<Reminder[]> {
  // Sort in memory to avoid needing a composite Firestore index
  // (equality on `acknowledged` + order by `deliverAt`).
  const snap = await db()
    .collection(paths.reminders(uid))
    .where("acknowledged", "==", false)
    .get();
  return snap.docs
    .map((d) => d.data() as Reminder)
    .sort((a, b) => a.deliverAt.localeCompare(b.deliverAt))
    .slice(0, 20);
}

export async function acknowledgeReminder(
  uid: string,
  id: string
): Promise<void> {
  await db()
    .doc(`${paths.reminders(uid)}/${id}`)
    .set({ acknowledged: true }, { merge: true });
}

/**
 * Escalate reminders that are overdue and still unacknowledged. The "adaptive"
 * part: Paula gets more insistent the longer a nudge is ignored. Run by cron.
 */
export async function escalateDueReminders(uid: string): Promise<number> {
  const now = new Date();
  const snap = await db()
    .collection(paths.reminders(uid))
    .where("acknowledged", "==", false)
    .get();
  let escalated = 0;
  const batch = db().batch();
  for (const doc of snap.docs) {
    const r = doc.data() as Reminder;
    if (new Date(r.deliverAt) <= now && r.escalationLevel < 3) {
      batch.update(doc.ref, {
        escalationLevel: FieldValue.increment(1),
        delivered: true,
      });
      escalated++;
    }
  }
  if (escalated > 0) await batch.commit();
  return escalated;
}

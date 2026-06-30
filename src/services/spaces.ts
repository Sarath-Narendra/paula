import "server-only";
import { FieldValue } from "firebase-admin/firestore";
import { db, paths } from "@/lib/firestore";
import type { Space, UserProfile } from "@/lib/types";

const nowIso = () => new Date().toISOString();

/** 6-char join code used as the space document id. */
function makeCode(): string {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";
  for (let i = 0; i < 6; i++)
    code += alphabet[Math.floor(Math.random() * alphabet.length)];
  return code;
}

export interface LeaderboardRow {
  uid: string;
  name: string;
  image?: string;
  credits: number;
  streak: number;
  tasksCompleted: number;
}

function toRow(uid: string, u: Partial<UserProfile>): LeaderboardRow {
  return {
    uid,
    name: u.name || u.email?.split("@")[0] || "Anonymous",
    image: u.image,
    credits: u.credits ?? 0,
    streak: u.streak ?? 0,
    tasksCompleted: u.tasksCompleted ?? 0,
  };
}

export async function createSpace(uid: string, name: string): Promise<Space> {
  let code = makeCode();
  // Avoid an existing-code collision (rare).
  for (let i = 0; i < 3; i++) {
    const existing = await db().doc(`${paths.spaces()}/${code}`).get();
    if (!existing.exists) break;
    code = makeCode();
  }
  const space: Space = {
    id: code,
    name: name.trim().slice(0, 60) || "My Space",
    ownerUid: uid,
    memberUids: [uid],
    createdAt: nowIso(),
  };
  await db().doc(`${paths.spaces()}/${code}`).set(space);
  return space;
}

export async function joinSpace(
  uid: string,
  code: string
): Promise<Space | null> {
  const ref = db().doc(`${paths.spaces()}/${code.toUpperCase().trim()}`);
  const snap = await ref.get();
  if (!snap.exists) return null;
  await ref.update({ memberUids: FieldValue.arrayUnion(uid) });
  const updated = await ref.get();
  return updated.data() as Space;
}

export async function leaveSpace(uid: string, code: string): Promise<void> {
  await db()
    .doc(`${paths.spaces()}/${code}`)
    .update({ memberUids: FieldValue.arrayRemove(uid) });
}

export async function getUserSpaces(uid: string): Promise<Space[]> {
  const snap = await db()
    .collection(paths.spaces())
    .where("memberUids", "array-contains", uid)
    .get();
  return snap.docs.map((d) => d.data() as Space);
}

/** Global leaderboard: top users by credits. */
export async function getGlobalLeaderboard(
  limit = 20
): Promise<LeaderboardRow[]> {
  const snap = await db()
    .collection("users")
    .orderBy("credits", "desc")
    .limit(limit)
    .get();
  return snap.docs.map((d) => toRow(d.id, d.data() as UserProfile));
}

/** Leaderboard scoped to the members of a space. */
export async function getSpaceLeaderboard(
  space: Space
): Promise<LeaderboardRow[]> {
  const rows = await Promise.all(
    space.memberUids.map(async (uid) => {
      const snap = await db().doc(paths.user(uid)).get();
      return snap.exists ? toRow(uid, snap.data() as UserProfile) : null;
    })
  );
  return rows
    .filter((r): r is LeaderboardRow => r !== null)
    .sort((a, b) => b.credits - a.credits);
}

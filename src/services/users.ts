import "server-only";
import { FieldValue } from "firebase-admin/firestore";
import { db, paths } from "@/lib/firestore";
import type { Chronotype, UserProfile, WorkWindow } from "@/lib/types";

/** Default Mon–Fri 09:00–18:00 + Sat 10:00–14:00 working windows. */
function defaultWorkWindows(): WorkWindow[] {
  const weekdays: WorkWindow[] = [1, 2, 3, 4, 5].map((weekday) => ({
    weekday,
    startMinute: 9 * 60,
    endMinute: 18 * 60,
  }));
  weekdays.push({ weekday: 6, startMinute: 10 * 60, endMinute: 14 * 60 });
  return weekdays;
}

function nowIso() {
  return new Date().toISOString();
}

/**
 * Create the user document on first sign-in, or refresh mutable identity
 * fields on subsequent sign-ins. Learning/preference fields are only seeded
 * once so we never clobber what Paula has learned.
 */
export async function upsertUserFromOAuth(input: {
  uid: string;
  email: string;
  name?: string;
  image?: string;
}): Promise<void> {
  const ref = db().doc(paths.user(input.uid));
  const snap = await ref.get();

  if (!snap.exists) {
    const profile: UserProfile = {
      uid: input.uid,
      email: input.email,
      name: input.name,
      image: input.image,
      timezone: "Asia/Kolkata",
      chronotype: "intermediate",
      workWindows: defaultWorkWindows(),
      effortMultiplier: 1.0,
      preferredHours: [10 * 60, 11 * 60, 15 * 60, 16 * 60],
      historicalCompletionRate: 0.7,
      procrastinationFactor: 0.3,
      credits: 0,
      streak: 0,
      subtasksCompleted: 0,
      tasksCompleted: 0,
      createdAt: nowIso(),
      updatedAt: nowIso(),
    };
    await ref.set(profile);
    return;
  }

  await ref.set(
    {
      email: input.email,
      name: input.name,
      image: input.image,
      updatedAt: nowIso(),
    },
    { merge: true }
  );
}

/**
 * Persist the Google refresh token so server-side jobs (cron replan) can act
 * on the user's calendar without an interactive session.
 *
 * NOTE: stored in Firestore for the hackathon. For production, move to Secret
 * Manager / envelope encryption.
 */
export async function saveRefreshToken(
  uid: string,
  refreshToken: string
): Promise<void> {
  await db()
    .doc(paths.user(uid))
    .set(
      { googleRefreshToken: refreshToken, updatedAt: nowIso() },
      { merge: true }
    );
}

export async function getRefreshToken(uid: string): Promise<string | null> {
  const snap = await db().doc(paths.user(uid)).get();
  return (snap.get("googleRefreshToken") as string | undefined) ?? null;
}

export async function getUser(uid: string): Promise<UserProfile | null> {
  const snap = await db().doc(paths.user(uid)).get();
  return snap.exists ? (snap.data() as UserProfile) : null;
}

/** All user ids — used by the cron replan job to act on every account. */
export async function listAllUserIds(): Promise<string[]> {
  const snap = await db().collection("users").select().get();
  return snap.docs.map((d) => d.id);
}

export async function updateUserPrefs(
  uid: string,
  patch: Partial<
    Pick<
      UserProfile,
      | "timezone"
      | "chronotype"
      | "workWindows"
      | "effortMultiplier"
      | "preferredHours"
      | "historicalCompletionRate"
      | "procrastinationFactor"
    >
  > & { chronotype?: Chronotype }
): Promise<void> {
  await db()
    .doc(paths.user(uid))
    .set({ ...patch, updatedAt: nowIso() }, { merge: true });
}

/** Adjust credits/streak atomically (used by gamification). */
export async function adjustCredits(
  uid: string,
  delta: number
): Promise<void> {
  await db()
    .doc(paths.user(uid))
    .set(
      { credits: FieldValue.increment(delta), updatedAt: nowIso() },
      { merge: true }
    );
}

import "server-only";
import {
  initializeApp,
  getApps,
  getApp,
  cert,
  applicationDefault,
  type App,
} from "firebase-admin/app";
import { getFirestore, Firestore } from "firebase-admin/firestore";
import { env } from "@/lib/env";

/**
 * Lazily initialize the Firebase Admin app.
 *
 * Credential resolution order:
 *  1. FIREBASE_SERVICE_ACCOUNT env (JSON string) — convenient for local dev.
 *  2. Application Default Credentials — used automatically on Cloud Run.
 */
let cachedApp: App | undefined;

function getAdminApp(): App {
  if (cachedApp) return cachedApp;
  if (getApps().length > 0) {
    cachedApp = getApp();
    return cachedApp;
  }

  const projectId = env.gcpProjectId || undefined;
  const saJson = env.firebaseServiceAccount;

  if (saJson) {
    const parsed = JSON.parse(saJson);
    cachedApp = initializeApp({
      credential: cert(parsed),
      projectId: parsed.project_id ?? projectId,
    });
  } else {
    cachedApp = initializeApp({
      credential: applicationDefault(),
      projectId,
    });
  }
  return cachedApp;
}

let cachedDb: Firestore | undefined;

/** Returns the shared Firestore instance (Admin SDK, server-only). */
export function db(): Firestore {
  if (cachedDb) return cachedDb;
  const firestore = getFirestore(getAdminApp());
  // Allow `undefined` fields to be dropped rather than throwing.
  try {
    firestore.settings({ ignoreUndefinedProperties: true });
  } catch {
    // settings() throws if called after first use; safe to ignore.
  }
  cachedDb = firestore;
  return cachedDb;
}

// ---- Collection path helpers (single source of truth for the data model) ----

export const paths = {
  user: (uid: string) => `users/${uid}`,
  tasks: (uid: string) => `users/${uid}/tasks`,
  task: (uid: string, taskId: string) => `users/${uid}/tasks/${taskId}`,
  subtasks: (uid: string, taskId: string) => `users/${uid}/tasks/${taskId}/subtasks`,
  blocks: (uid: string) => `users/${uid}/blocks`,
  events: (uid: string) => `users/${uid}/events`,
  reminders: (uid: string) => `users/${uid}/reminders`,
  activity: (uid: string) => `users/${uid}/activity`,
  spaces: () => `spaces`,
};

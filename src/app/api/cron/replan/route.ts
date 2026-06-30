import { NextResponse } from "next/server";
import { env } from "@/lib/env";
import { listAllUserIds } from "@/services/users";
import { oauthClientForUser } from "@/lib/google";
import { replanUser } from "@/services/planner";
import { escalateDueReminders } from "@/services/reminders";

export const runtime = "nodejs";
export const maxDuration = 300;

/**
 * Autonomous replan for ALL users — the engine that keeps every plan "alive"
 * even when no one is using the app. Invoked by Cloud Scheduler.
 *
 * Auth: requires the CRON_SECRET via `Authorization: Bearer <secret>` or
 * `?key=<secret>`. Cloud Scheduler is configured to send this header.
 */
async function handle(req: Request) {
  const url = new URL(req.url);
  const provided =
    req.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ||
    url.searchParams.get("key") ||
    "";

  if (!env.cronSecret || provided !== env.cronSecret) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const uids = await listAllUserIds();
  let usersChanged = 0;
  let tasksChanged = 0;

  for (const uid of uids) {
    try {
      // Use the stored refresh token — no active session required.
      const client = await oauthClientForUser(uid);
      const summaries = await replanUser(uid, client, "auto");
      const changed = summaries.filter((s) => s.changed).length;
      if (changed > 0) {
        usersChanged++;
        tasksChanged += changed;
      }
      // Make ignored nudges progressively more insistent.
      await escalateDueReminders(uid);
    } catch (err) {
      console.error(`[cron/replan] user ${uid} failed`, err);
    }
  }

  return NextResponse.json({
    ranAt: new Date().toISOString(),
    users: uids.length,
    usersChanged,
    tasksChanged,
  });
}

export async function GET(req: Request) {
  return handle(req);
}
export async function POST(req: Request) {
  return handle(req);
}

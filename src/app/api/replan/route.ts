import { NextResponse } from "next/server";
import { getSessionContext } from "@/lib/session";
import { replanUser } from "@/services/planner";

export const runtime = "nodejs";
export const maxDuration = 60;

/** Manual / event-driven replan for the signed-in user. */
export async function POST(req: Request) {
  const ctx = await getSessionContext();
  if (!ctx) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let reason = "manual";
  try {
    const body = await req.json();
    if (body?.reason) reason = String(body.reason).slice(0, 40);
  } catch {
    // no body — default reason
  }

  try {
    const summaries = await replanUser(ctx.uid, ctx.client, reason);
    const changed = summaries.filter((s) => s.changed);
    return NextResponse.json({
      checked: summaries.length,
      changed: changed.length,
      summaries,
    });
  } catch (err) {
    console.error("[/api/replan] failed", err);
    return NextResponse.json(
      { error: "Replan failed", message: (err as Error).message },
      { status: 500 }
    );
  }
}

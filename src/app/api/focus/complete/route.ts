import { NextResponse } from "next/server";
import { z } from "zod";
import { getSessionContext } from "@/lib/session";
import { completeSubtask, recordFocusSession } from "@/services/gamification";
import { adjustCredits } from "@/services/users";

export const runtime = "nodejs";

const bodySchema = z.object({
  taskId: z.string().optional(),
  subtaskId: z.string().optional(),
  actualMinutes: z.number().min(0).max(600),
  distractions: z.number().int().min(0).max(100).default(0),
  completeSubtask: z.boolean().default(false),
});

export async function POST(req: Request) {
  const ctx = await getSessionContext();
  if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const parsed = bodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid input" }, { status: 400 });
  }
  const { taskId, subtaskId, actualMinutes, distractions, completeSubtask: done } =
    parsed.data;

  // Focused on a real subtask and chose to mark it done: completion credits +
  // effort learning, then a small distraction penalty.
  if (done && taskId && subtaskId) {
    const result = await completeSubtask(ctx.uid, taskId, subtaskId, {
      actualMinutes: Math.round(actualMinutes),
    });
    if (distractions > 0) await adjustCredits(ctx.uid, -distractions * 2);
    return NextResponse.json({ kind: "completion", result, distractions });
  }

  // Otherwise record a standalone focus session.
  const { credits } = await recordFocusSession(ctx.uid, {
    minutes: actualMinutes,
    distractions,
  });
  return NextResponse.json({ kind: "focus", credits });
}

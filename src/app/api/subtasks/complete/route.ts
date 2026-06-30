import { NextResponse } from "next/server";
import { z } from "zod";
import { getSessionContext } from "@/lib/session";
import { completeSubtask } from "@/services/gamification";

export const runtime = "nodejs";

const bodySchema = z.object({
  taskId: z.string().min(1),
  subtaskId: z.string().min(1),
});

export async function POST(req: Request) {
  const ctx = await getSessionContext();
  if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const parsed = bodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid input" }, { status: 400 });
  }

  const result = await completeSubtask(
    ctx.uid,
    parsed.data.taskId,
    parsed.data.subtaskId
  );
  if (!result) {
    return NextResponse.json(
      { error: "Subtask not found or already done" },
      { status: 404 }
    );
  }
  return NextResponse.json(result);
}

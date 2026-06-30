import { NextResponse } from "next/server";
import { z } from "zod";
import { getSessionContext } from "@/lib/session";
import { createPlan } from "@/services/planner";
import type { Importance } from "@/lib/types";

export const runtime = "nodejs";
export const maxDuration = 60;

const bodySchema = z.object({
  goal: z.string().min(3).max(500),
  deadline: z.string().min(1), // ISO
  importance: z.number().int().min(1).max(5).default(3),
});

export async function POST(req: Request) {
  const ctx = await getSessionContext();
  if (!ctx) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid input", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  try {
    const result = await createPlan(ctx.uid, ctx.client, {
      goal: parsed.data.goal,
      deadline: parsed.data.deadline,
      importance: parsed.data.importance as Importance,
    });
    return NextResponse.json(result);
  } catch (err) {
    console.error("[/api/plan] failed", err);
    return NextResponse.json(
      { error: "Planning failed", message: (err as Error).message },
      { status: 500 }
    );
  }
}

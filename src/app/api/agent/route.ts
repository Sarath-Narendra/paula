import { NextResponse } from "next/server";
import { z } from "zod";
import { getSessionContext } from "@/lib/session";
import { runAgent } from "@/services/agent";

export const runtime = "nodejs";
export const maxDuration = 60;

const bodySchema = z.object({
  message: z.string().min(1).max(2000),
  history: z
    .array(
      z.object({
        role: z.enum(["user", "model"]),
        text: z.string(),
      })
    )
    .max(20)
    .optional(),
});

export async function POST(req: Request) {
  const ctx = await getSessionContext();
  if (!ctx) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const parsed = bodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid input" }, { status: 400 });
  }

  try {
    const result = await runAgent({
      uid: ctx.uid,
      client: ctx.client,
      message: parsed.data.message,
      history: parsed.data.history,
    });
    return NextResponse.json(result);
  } catch (err) {
    console.error("[/api/agent] failed", err);
    return NextResponse.json(
      { error: "Agent failed", message: (err as Error).message },
      { status: 500 }
    );
  }
}

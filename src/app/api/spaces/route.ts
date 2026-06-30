import { NextResponse } from "next/server";
import { z } from "zod";
import { getSessionContext } from "@/lib/session";
import { createSpace, joinSpace, leaveSpace } from "@/services/spaces";

export const runtime = "nodejs";

const bodySchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("create"), name: z.string().min(1).max(60) }),
  z.object({ action: z.literal("join"), code: z.string().min(4).max(8) }),
  z.object({ action: z.literal("leave"), code: z.string().min(4).max(8) }),
]);

export async function POST(req: Request) {
  const ctx = await getSessionContext();
  if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const parsed = bodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid input" }, { status: 400 });
  }

  const data = parsed.data;
  if (data.action === "create") {
    const space = await createSpace(ctx.uid, data.name);
    return NextResponse.json({ space });
  }
  if (data.action === "join") {
    const space = await joinSpace(ctx.uid, data.code);
    if (!space) {
      return NextResponse.json({ error: "No space with that code" }, { status: 404 });
    }
    return NextResponse.json({ space });
  }
  await leaveSpace(ctx.uid, data.code);
  return NextResponse.json({ ok: true });
}

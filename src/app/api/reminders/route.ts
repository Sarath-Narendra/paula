import { NextResponse } from "next/server";
import { z } from "zod";
import { getSessionContext } from "@/lib/session";
import { listReminders, acknowledgeReminder } from "@/services/reminders";

export const runtime = "nodejs";

export async function GET() {
  const ctx = await getSessionContext();
  if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const reminders = await listReminders(ctx.uid);
  const now = Date.now();
  return NextResponse.json({
    reminders,
    dueCount: reminders.filter((r) => new Date(r.deliverAt).getTime() <= now)
      .length,
  });
}

const ackSchema = z.object({ id: z.string().min(1) });

export async function POST(req: Request) {
  const ctx = await getSessionContext();
  if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const parsed = ackSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid input" }, { status: 400 });
  }
  await acknowledgeReminder(ctx.uid, parsed.data.id);
  return NextResponse.json({ ok: true });
}

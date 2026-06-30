import { differenceInMinutes, parseISO } from "date-fns";
import { getSessionContext } from "@/lib/session";
import { listBlocks } from "@/services/tasks";
import {
  FocusSession,
  type FocusItem,
} from "@/components/dashboard/focus-session";
import { Card, CardContent } from "@/components/ui/card";
import { ShieldOff } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function FocusPage() {
  const ctx = await getSessionContext();

  let items: FocusItem[] = [];
  if (ctx) {
    const now = new Date();
    items = (await listBlocks(ctx.uid))
      .filter(
        (b) =>
          b.type === "work" &&
          b.subtaskId &&
          b.status !== "completed" &&
          parseISO(b.end) > now
      )
      .slice(0, 6)
      .map((b) => ({
        taskId: b.taskId,
        subtaskId: b.subtaskId,
        title: b.title,
        minutes: Math.max(
          5,
          differenceInMinutes(parseISO(b.end), parseISO(b.start))
        ),
      }));
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Focus</h1>
        <p className="text-muted-foreground">
          A distraction-aware focus session. Leaving the tab costs credits —
          gentle incentive over willpower.
        </p>
      </div>

      <FocusSession items={items} />

      <Card>
        <CardContent className="flex items-start gap-3 py-4 text-sm text-muted-foreground">
          <ShieldOff className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
          <p>
            On the web, Paula rewards staying on-task by detecting when you
            switch away. Full system-level app &amp; notification blocking is on
            the roadmap for the native companion app.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

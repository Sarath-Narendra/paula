import { getSessionContext } from "@/lib/session";
import { listActivity } from "@/services/tasks";
import { ActivityFeed } from "@/components/dashboard/activity-feed";
import { ReplanButton } from "@/components/dashboard/replan-button";
import { Card, CardContent } from "@/components/ui/card";
import type { ActivityEntry } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function ActivityPage() {
  const ctx = await getSessionContext();
  const entries: ActivityEntry[] = ctx ? await listActivity(ctx.uid, 50) : [];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Activity</h1>
          <p className="text-muted-foreground">
            Every autonomous action Paula takes — and why. Your plan stays alive
            even when you&apos;re away.
          </p>
        </div>
        <ReplanButton reason="manual" />
      </div>

      <Card>
        <CardContent className="py-4">
          <ActivityFeed entries={entries} />
        </CardContent>
      </Card>

      <p className="text-center text-xs text-muted-foreground">
        Paula also re-plans automatically in the background via a scheduled job —
        reacting to new meetings, missed sessions, and shifting priorities.
      </p>
    </div>
  );
}

import { addDays } from "date-fns";
import { getSessionContext } from "@/lib/session";
import { listEvents } from "@/lib/calendar";
import { EventList, type DisplayEvent } from "@/components/dashboard/event-list";
import { PaulaChat } from "@/components/dashboard/paula-chat";
import { LearningCard } from "@/components/dashboard/learning-card";
import { getUser } from "@/services/users";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CalendarClock, TriangleAlert } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function TodayPage() {
  const ctx = await getSessionContext();
  const firstName = ctx?.name?.split(" ")[0] ?? "there";
  const user = ctx ? await getUser(ctx.uid) : null;

  let events: DisplayEvent[] = [];
  let calendarError = false;
  if (ctx?.client) {
    try {
      const now = new Date();
      events = await listEvents(
        ctx.client,
        now.toISOString(),
        addDays(now, 2).toISOString()
      );
    } catch {
      calendarError = true;
    }
  } else {
    calendarError = true;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">
          Good to see you, {firstName}.
        </h1>
        <p className="text-muted-foreground">
          Here&apos;s the next 48 hours. Tell Paula a goal and it&apos;ll build
          the plan around this.
        </p>
      </div>

      {calendarError && (
        <Card className="border-amber-500/40 bg-amber-500/5">
          <CardContent className="flex items-start gap-3 py-4">
            <TriangleAlert className="mt-0.5 h-5 w-5 text-amber-500" />
            <div className="text-sm">
              <p className="font-medium">Calendar not connected</p>
              <p className="text-muted-foreground">
                Paula couldn&apos;t read your Google Calendar. Sign out and back
                in to grant calendar access.
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-6 lg:grid-cols-5">
        <div className="lg:col-span-3">
          <PaulaChat />
        </div>
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <CalendarClock className="h-4 w-4 text-primary" />
              Next 48 hours
            </CardTitle>
          </CardHeader>
          <CardContent>
            <EventList events={events} />
          </CardContent>
        </Card>
      </div>

      {user && <LearningCard user={user} />}
    </div>
  );
}

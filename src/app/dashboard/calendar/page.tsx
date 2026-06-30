import { addDays } from "date-fns";
import { getSessionContext } from "@/lib/session";
import { listEvents } from "@/lib/calendar";
import { EventList, type DisplayEvent } from "@/components/dashboard/event-list";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CalendarDays } from "lucide-react";

export default async function CalendarPage() {
  const ctx = await getSessionContext();
  let events: DisplayEvent[] = [];
  if (ctx?.client) {
    try {
      const now = new Date();
      events = await listEvents(
        ctx.client,
        now.toISOString(),
        addDays(now, 7).toISOString()
      );
    } catch {
      // surfaced as empty state below
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Calendar</h1>
        <p className="text-muted-foreground">
          The next 7 days from your Google Calendar — Paula&apos;s source of
          truth for available time.
        </p>
      </div>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <CalendarDays className="h-4 w-4 text-primary" />
            Next 7 days
          </CardTitle>
        </CardHeader>
        <CardContent>
          <EventList events={events} />
        </CardContent>
      </Card>
    </div>
  );
}

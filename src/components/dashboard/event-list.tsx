import { format, isSameDay, parseISO } from "date-fns";
import { Clock } from "lucide-react";

export interface DisplayEvent {
  gcalEventId: string;
  summary?: string;
  start: string;
  end: string;
}

function timeLabel(start: string, end: string) {
  // All-day events have date-only strings (no "T").
  if (!start.includes("T")) return "All day";
  try {
    return `${format(parseISO(start), "h:mm a")} – ${format(
      parseISO(end),
      "h:mm a"
    )}`;
  } catch {
    return "";
  }
}

/** Groups events by calendar day and renders them as a vertical agenda. */
export function EventList({ events }: { events: DisplayEvent[] }) {
  if (events.length === 0) {
    return (
      <p className="rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground">
        No events in this window. Your calendar is wide open.
      </p>
    );
  }

  const groups: { day: Date; items: DisplayEvent[] }[] = [];
  for (const ev of events) {
    const day = ev.start.includes("T")
      ? parseISO(ev.start)
      : parseISO(`${ev.start}T00:00:00`);
    const last = groups[groups.length - 1];
    if (last && isSameDay(last.day, day)) {
      last.items.push(ev);
    } else {
      groups.push({ day, items: [ev] });
    }
  }

  return (
    <div className="space-y-6">
      {groups.map((group) => (
        <div key={group.day.toISOString()}>
          <h3 className="mb-2 text-sm font-semibold text-muted-foreground">
            {format(group.day, "EEEE, MMM d")}
          </h3>
          <ul className="space-y-2">
            {group.items.map((ev) => (
              <li
                key={ev.gcalEventId}
                className="flex items-center justify-between rounded-lg border bg-card px-4 py-3"
              >
                <span className="font-medium">
                  {ev.summary || "(no title)"}
                </span>
                <span className="flex items-center gap-1.5 text-sm text-muted-foreground">
                  <Clock className="h-3.5 w-3.5" />
                  {timeLabel(ev.start, ev.end)}
                </span>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}

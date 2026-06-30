import "server-only";
import { calendarFor, type OAuthClient } from "@/lib/google";

export interface BusyInterval {
  start: string; // ISO
  end: string; // ISO
}

export interface CalendarEventInput {
  summary: string;
  description?: string;
  start: string; // ISO
  end: string; // ISO
  /** Hex-less Google colorId, optional. */
  colorId?: string;
}

/**
 * Query free/busy for the primary calendar between two instants.
 * Returns the list of busy intervals (the inverse is the schedulable time).
 */
export async function getBusyIntervals(
  client: OAuthClient,
  timeMin: string,
  timeMax: string
): Promise<BusyInterval[]> {
  const calendar = calendarFor(client);
  const res = await calendar.freebusy.query({
    requestBody: {
      timeMin,
      timeMax,
      items: [{ id: "primary" }],
    },
  });
  const busy = res.data.calendars?.primary?.busy ?? [];
  return busy
    .filter((b): b is { start: string; end: string } => !!b.start && !!b.end)
    .map((b) => ({ start: b.start, end: b.end }));
}

/** List events (lightweight) in a window — used to cache real commitments. */
export async function listEvents(
  client: OAuthClient,
  timeMin: string,
  timeMax: string
) {
  const calendar = calendarFor(client);
  const res = await calendar.events.list({
    calendarId: "primary",
    timeMin,
    timeMax,
    singleEvents: true,
    orderBy: "startTime",
    maxResults: 250,
  });
  return (res.data.items ?? []).map((e) => ({
    gcalEventId: e.id ?? "",
    summary: e.summary ?? undefined,
    start: e.start?.dateTime ?? e.start?.date ?? "",
    end: e.end?.dateTime ?? e.end?.date ?? "",
  }));
}

export async function createEvent(
  client: OAuthClient,
  input: CalendarEventInput
): Promise<string> {
  const calendar = calendarFor(client);
  const res = await calendar.events.insert({
    calendarId: "primary",
    requestBody: {
      summary: input.summary,
      description: input.description,
      start: { dateTime: input.start },
      end: { dateTime: input.end },
      colorId: input.colorId,
      // Tag Paula-created events so we can recognize/clean them up.
      extendedProperties: { private: { paula: "1" } },
    },
  });
  return res.data.id ?? "";
}

export async function updateEvent(
  client: OAuthClient,
  eventId: string,
  input: Partial<CalendarEventInput>
): Promise<void> {
  const calendar = calendarFor(client);
  await calendar.events.patch({
    calendarId: "primary",
    eventId,
    requestBody: {
      summary: input.summary,
      description: input.description,
      start: input.start ? { dateTime: input.start } : undefined,
      end: input.end ? { dateTime: input.end } : undefined,
      colorId: input.colorId,
    },
  });
}

export async function deleteEvent(
  client: OAuthClient,
  eventId: string
): Promise<void> {
  const calendar = calendarFor(client);
  try {
    await calendar.events.delete({ calendarId: "primary", eventId });
  } catch (err: unknown) {
    // Ignore 404/410 — the event is already gone.
    const code = (err as { code?: number })?.code;
    if (code !== 404 && code !== 410) throw err;
  }
}

import * as Calendar from "expo-calendar/next";
import { Platform } from "react-native";

import type { TrackedDomainWithDetails } from "@domainstack/types";
import { buildDomainExpiryEvents, type DomainExpiryEvent } from "@domainstack/utils/calendar";

import { apiBaseUrl } from "./env";
import { useCalendarSyncStore } from "./stores/calendar-sync-store";

const CALENDAR_TITLE = "Domainstack";
const CALENDAR_COLOR = "#000000";

/**
 * Outcome of asking for calendar access:
 * - `granted`  — we can read/write the calendar.
 * - `denied`   — declined, but the OS will still let us re-prompt (Android);
 *                the caller can retry the in-app action.
 * - `blocked`  — the OS won't show a prompt anymore (iOS after the one-time
 *                ask, or "don't ask again"). The *only* way back is the system
 *                Settings app, so the caller must deep-link there.
 */
export type CalendarPermissionStatus = "granted" | "denied" | "blocked";

/**
 * Ask for calendar access.
 *
 * `requestCalendarPermissions()` (no `writeOnly`) requests **full** access on
 * iOS 17+, which is what we need: reconciliation reads our own events back to
 * diff them. Distinguishes `denied` (re-promptable) from `blocked` (we can no
 * longer ask ourselves → caller must send the user to Settings).
 */
export async function ensurePermission(): Promise<CalendarPermissionStatus> {
  const current = await Calendar.getCalendarPermissions();
  if (current.granted) return "granted";
  // Already answered and the OS won't let us prompt again — Settings only.
  if (!current.canAskAgain) return "blocked";
  const requested = await Calendar.requestCalendarPermissions();
  if (requested.granted) return "granted";
  return requested.canAskAgain ? "denied" : "blocked";
}

/**
 * Read-only permission check for background reconciliation — never prompts.
 * The auto-sync hook uses this to skip work when access isn't granted.
 */
export async function hasCalendarPermission(): Promise<boolean> {
  const current = await Calendar.getCalendarPermissions();
  return current.granted;
}

/**
 * Pick a writable calendar source. iOS requires an existing source (the
 * default calendar's, falling back to the device-local one); Android uses a
 * synthetic local account.
 */
function resolveCalendarSource(): Calendar.Source {
  if (Platform.OS === "android") {
    return { isLocalAccount: true, name: CALENDAR_TITLE, type: "" };
  }

  try {
    const defaultCalendar = Calendar.getDefaultCalendarSync();
    if (defaultCalendar?.source) return defaultCalendar.source;
  } catch {
    // Fall through to source enumeration.
  }

  const sources = Calendar.getSourcesSync();
  const local = sources.find((s) => s.type === Calendar.SourceType.LOCAL);
  // Never fall back to a read-only source (subscribed/birthday calendars) —
  // `createCalendar` against one throws an opaque native error surfaced as a
  // generic toast. Prefer LOCAL, then any other writable source.
  const writable = sources.find(
    (s) => s.type !== Calendar.SourceType.SUBSCRIBED && s.type !== Calendar.SourceType.BIRTHDAYS,
  );
  const source = local ?? writable;
  if (!source) {
    throw new Error("No writable calendar source available on this device.");
  }
  return source;
}

/**
 * Return the app-owned "Domainstack" calendar, reusing the persisted one if it
 * still exists on the device, otherwise creating it. The resolved id is
 * written back to the store.
 */
async function ensureCalendar(): Promise<Calendar.ExpoCalendar> {
  const existingId = useCalendarSyncStore.getState().calendarId;

  if (existingId) {
    try {
      return await Calendar.ExpoCalendar.get(existingId);
    } catch {
      // The user deleted the calendar — fall through and recreate it.
    }
  }

  const source = resolveCalendarSource();
  const calendar = await Calendar.createCalendar({
    title: CALENDAR_TITLE,
    name: CALENDAR_TITLE,
    color: CALENDAR_COLOR,
    entityType: Calendar.EntityTypes.EVENT,
    sourceId: source.id,
    source,
    ownerAccount: CALENDAR_TITLE,
    accessLevel: Calendar.CalendarAccessLevel.OWNER,
  });

  useCalendarSyncStore.getState().setCalendarId(calendar.id);
  useCalendarSyncStore.getState().setEventMap({});
  return calendar;
}

export interface CalendarDiff {
  /** Desired events that have no calendar event yet. */
  creates: DomainExpiryEvent[];
  /** Desired events that already have a calendar event id. */
  updates: Array<{ eventId: string; event: DomainExpiryEvent }>;
  /** Calendar event ids whose domain is no longer a desired target. */
  deletes: string[];
}

/**
 * Pure diff between desired expiry events and the persisted
 * `trackedDomainId → eventId` map. Side-effect free and unit-tested in
 * isolation; all `Calendar.*` mutations happen in {@link reconcile}.
 */
export function diffEvents(
  targets: DomainExpiryEvent[],
  eventMap: Record<string, string>,
): CalendarDiff {
  const creates: DomainExpiryEvent[] = [];
  const updates: Array<{ eventId: string; event: DomainExpiryEvent }> = [];
  const targetIds = new Set<string>();

  for (const event of targets) {
    targetIds.add(event.trackedDomainId);
    const eventId = eventMap[event.trackedDomainId];
    if (eventId) {
      updates.push({ eventId, event });
    } else {
      creates.push(event);
    }
  }

  const deletes: string[] = [];
  for (const [trackedDomainId, eventId] of Object.entries(eventMap)) {
    if (!targetIds.has(trackedDomainId)) {
      deletes.push(eventId);
    }
  }

  return { creates, updates, deletes };
}

/**
 * All-day event window for a domain expiry. EventKit / CalendarProvider place
 * an all-day event on whatever calendar day its `startDate` falls on in the
 * device's local time zone, so we anchor to **local midnight of the
 * expiration's calendar date** (derived from its UTC Y/M/D, matching the web
 * ICS `DATE` value) to avoid a timezone off-by-one.
 */
export function allDayWindow(expirationDate: Date): { startDate: Date; endDate: Date } {
  const year = expirationDate.getUTCFullYear();
  const month = expirationDate.getUTCMonth();
  const day = expirationDate.getUTCDate();
  return {
    startDate: new Date(year, month, day, 0, 0, 0, 0),
    endDate: new Date(year, month, day + 1, 0, 0, 0, 0),
  };
}

/** Local calendar-day key (TZ/serialization tolerant) for comparing all-day starts. */
function dayKey(value: string | Date): string {
  const date = value instanceof Date ? value : new Date(value);
  return `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
}

function eventDetails(event: DomainExpiryEvent): Partial<Calendar.ModifiableEventProperties> {
  const { startDate, endDate } = allDayWindow(event.expirationDate);
  return {
    title: event.summary,
    notes: event.description,
    url: event.url,
    startDate,
    endDate,
    allDay: true,
    // No alarms: the calendar is visibility-only — push already reminds.
    alarms: [],
    availability: Calendar.Availability.FREE,
  };
}

/**
 * `true` when the live calendar event already matches the desired content, so
 * we can skip a redundant write (and avoid churn on every foreground sync).
 */
function eventMatches(existing: Calendar.ExpoCalendarEvent, event: DomainExpiryEvent): boolean {
  const { startDate } = allDayWindow(event.expirationDate);
  return (
    existing.title === event.summary &&
    existing.notes === event.description &&
    existing.allDay === true &&
    dayKey(existing.startDate) === dayKey(startDate)
  );
}

async function reconcileInner(domains: TrackedDomainWithDetails[]): Promise<number> {
  const calendar = await ensureCalendar();
  const targets = buildDomainExpiryEvents(domains, { baseUrl: apiBaseUrl });
  const eventMap = { ...useCalendarSyncStore.getState().eventMap };
  const { creates, updates, deletes } = diffEvents(targets, eventMap);

  try {
    for (const event of creates) {
      const created = await calendar.createEvent(eventDetails(event));
      eventMap[event.trackedDomainId] = created.id;
    }

    for (const { eventId, event } of updates) {
      try {
        const existing = await Calendar.ExpoCalendarEvent.get(eventId);
        if (!eventMatches(existing, event)) {
          await existing.update(eventDetails(event));
        }
      } catch {
        // The user deleted the event (or it otherwise vanished) — recreate it
        // and re-point the map at the fresh id.
        const recreated = await calendar.createEvent(eventDetails(event));
        eventMap[event.trackedDomainId] = recreated.id;
      }
    }

    for (const eventId of deletes) {
      try {
        const stale = await Calendar.ExpoCalendarEvent.get(eventId);
        await stale.delete();
      } catch {
        // Already gone — fine.
      }
      for (const [trackedDomainId, id] of Object.entries(eventMap)) {
        if (id === eventId) delete eventMap[trackedDomainId];
      }
    }

    useCalendarSyncStore.getState().setLastSyncedAt(Date.now());
    return targets.length;
  } finally {
    // Always persist the in-memory map — even if a loop threw partway (e.g.
    // calendar permission revoked between createEvent calls). Without this the
    // freshly-created event ids are lost and the next run recreates them as
    // duplicates.
    useCalendarSyncStore.getState().setEventMap(eventMap);
  }
}

// Serialize reconcile runs. `use-calendar-sync.ts` can fire a throttled
// foreground run and a debounced portfolio-change run near-simultaneously;
// without this, both read the same `eventMap` snapshot and race to
// `createEvent`, producing duplicate calendar events. Each call still gets its
// own result/error; a prior failure does not block subsequent runs.
let reconcileTail: Promise<unknown> = Promise.resolve();

/**
 * Reconcile the device calendar with the user's verified, expiring domains:
 * create missing events, update changed ones, delete stale ones, then persist
 * the refreshed `trackedDomainId → eventId` map and `lastSyncedAt`.
 *
 * Runs are serialized (never concurrent) and the event map is persisted even
 * on partial failure.
 *
 * Returns the number of events the calendar now tracks.
 */
export function reconcile(domains: TrackedDomainWithDetails[]): Promise<number> {
  const result = reconcileTail.then(
    () => reconcileInner(domains),
    () => reconcileInner(domains),
  );
  reconcileTail = result.then(
    () => undefined,
    () => undefined,
  );
  return result;
}

/**
 * Remove the app-owned calendar (and all its events) and reset local state.
 * Used by "Remove from calendar" and on sign-out so a previous user's domains
 * never linger on a shared device.
 */
export async function teardown(): Promise<void> {
  const calendarId = useCalendarSyncStore.getState().calendarId;
  if (calendarId) {
    try {
      const calendar = await Calendar.ExpoCalendar.get(calendarId);
      await calendar.delete();
    } catch {
      // Calendar already deleted by the user — nothing to clean up.
    }
  }
  useCalendarSyncStore.getState().reset();
}

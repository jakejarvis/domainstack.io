/* @vitest-environment node */
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { DomainExpiryEvent } from "@domainstack/utils/calendar";

// `calendar-sync.ts` imports native-only modules at load time. Stub them just
// enough for the import to resolve in Node; the permission fns are real mocks
// so `ensurePermission`'s granted/denied/blocked mapping can be asserted.
type PermLike = { granted: boolean; canAskAgain: boolean; status: string; expires: string };

const { getCalendarPermissions, requestCalendarPermissions } = vi.hoisted(() => ({
  getCalendarPermissions: vi.fn<() => Promise<PermLike>>(),
  requestCalendarPermissions: vi.fn<() => Promise<PermLike>>(),
}));

vi.mock("expo-calendar/next", () => ({
  EntityTypes: { EVENT: "event" },
  SourceType: { LOCAL: "local" },
  Availability: { FREE: "free" },
  CalendarAccessLevel: { OWNER: "owner" },
  getCalendarPermissions,
  requestCalendarPermissions,
  // `diffEvents` (a pure unit) never touches these; stub the shared-object
  // classes just enough for the module import to resolve.
  ExpoCalendar: { get: async () => ({}) },
  ExpoCalendarEvent: { get: async () => ({}) },
}));
vi.mock("react-native", () => ({ Platform: { OS: "ios" } }));
vi.mock("./env", () => ({ apiBaseUrl: "https://domainstack.io" }));

const { diffEvents, ensurePermission } = await import("./calendar-sync");

function perm(granted: boolean, canAskAgain: boolean) {
  return { granted, canAskAgain, status: granted ? "granted" : "denied", expires: "never" };
}

describe("ensurePermission", () => {
  beforeEach(() => {
    getCalendarPermissions.mockReset();
    requestCalendarPermissions.mockReset();
  });

  it("returns 'granted' without prompting when access is already granted", async () => {
    getCalendarPermissions.mockResolvedValue(perm(true, false));
    expect(await ensurePermission()).toBe("granted");
    expect(requestCalendarPermissions).not.toHaveBeenCalled();
  });

  it("returns 'blocked' without prompting when the OS won't ask again", async () => {
    getCalendarPermissions.mockResolvedValue(perm(false, false));
    expect(await ensurePermission()).toBe("blocked");
    expect(requestCalendarPermissions).not.toHaveBeenCalled();
  });

  it("prompts and returns 'granted' when the user accepts", async () => {
    getCalendarPermissions.mockResolvedValue(perm(false, true));
    requestCalendarPermissions.mockResolvedValue(perm(true, false));
    expect(await ensurePermission()).toBe("granted");
  });

  it("returns 'denied' when declined but the OS will still re-prompt", async () => {
    getCalendarPermissions.mockResolvedValue(perm(false, true));
    requestCalendarPermissions.mockResolvedValue(perm(false, true));
    expect(await ensurePermission()).toBe("denied");
  });

  it("returns 'blocked' when declining also disables future prompts", async () => {
    getCalendarPermissions.mockResolvedValue(perm(false, true));
    requestCalendarPermissions.mockResolvedValue(perm(false, false));
    expect(await ensurePermission()).toBe("blocked");
  });
});

function event(id: string, overrides: Partial<DomainExpiryEvent> = {}): DomainExpiryEvent {
  return {
    uid: `${id}@domainstack.io`,
    trackedDomainId: id,
    domainName: `${id}.com`,
    expirationDate: new Date("2030-01-01T00:00:00.000Z"),
    summary: `🌐 ${id}.com expires`,
    description: `Domain: ${id}.com`,
    url: `https://domainstack.io/dashboard?domainId=${id}`,
    ...overrides,
  };
}

describe("diffEvents", () => {
  it("creates events for targets with no mapping", () => {
    const diff = diffEvents([event("a"), event("b")], {});
    expect(diff.creates.map((e) => e.trackedDomainId)).toEqual(["a", "b"]);
    expect(diff.updates).toEqual([]);
    expect(diff.deletes).toEqual([]);
  });

  it("updates events that already have a mapped id", () => {
    const diff = diffEvents([event("a"), event("b")], { a: "evt_a", b: "evt_b" });
    expect(diff.creates).toEqual([]);
    expect(diff.updates).toEqual([
      { eventId: "evt_a", event: event("a") },
      { eventId: "evt_b", event: event("b") },
    ]);
    expect(diff.deletes).toEqual([]);
  });

  it("deletes mapped events whose domain is no longer a target", () => {
    const diff = diffEvents([event("a")], { a: "evt_a", stale: "evt_stale" });
    expect(diff.creates).toEqual([]);
    expect(diff.updates).toEqual([{ eventId: "evt_a", event: event("a") }]);
    expect(diff.deletes).toEqual(["evt_stale"]);
  });

  it("handles a mixed create / update / delete reconciliation", () => {
    const diff = diffEvents([event("keep"), event("new")], {
      keep: "evt_keep",
      gone: "evt_gone",
    });
    expect(diff.creates.map((e) => e.trackedDomainId)).toEqual(["new"]);
    expect(diff.updates).toEqual([{ eventId: "evt_keep", event: event("keep") }]);
    expect(diff.deletes).toEqual(["evt_gone"]);
  });

  it("deletes everything when there are no targets", () => {
    const diff = diffEvents([], { a: "evt_a", b: "evt_b" });
    expect(diff.creates).toEqual([]);
    expect(diff.updates).toEqual([]);
    expect(diff.deletes.sort()).toEqual(["evt_a", "evt_b"]);
  });

  it("returns empty buckets when targets and map are both empty", () => {
    expect(diffEvents([], {})).toEqual({ creates: [], updates: [], deletes: [] });
  });
});

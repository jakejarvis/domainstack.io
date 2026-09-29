import { useQueryClient } from "@tanstack/react-query";
import { TRPCClientError, createTRPCClient, type TRPCLink } from "@trpc/client";
import { observable } from "@trpc/server/observable";
import { createTRPCOptionsProxy } from "@trpc/tanstack-react-query";
import { useMemo } from "react";
import { vi } from "vitest";

import type { AppRouter, RouterInputs, RouterOutputs } from "@domainstack/api";
import type {
  NotificationData as NotificationItem,
  TrackedDomainWithDetails,
} from "@domainstack/types";

type In = RouterInputs;
type Out = RouterOutputs;

let domainsState: TrackedDomainWithDetails[] = [];

export function setDomainsState(items: TrackedDomainWithDetails[]) {
  domainsState = items.map((item) => ({ ...item }));
}

type ListDomainsInput = In["tracking"]["listDomains"];

async function defaultListDomains(
  input?: ListDomainsInput,
): Promise<Out["tracking"]["listDomains"]> {
  const includeArchived = input?.includeArchived ?? false;
  if (includeArchived) {
    return domainsState;
  }
  return domainsState.filter((item) => item.archivedAt == null);
}

export const listDomainsQuery =
  vi.fn<(input?: ListDomainsInput) => Promise<Out["tracking"]["listDomains"]>>(defaultListDomains);

async function defaultTrackingStatus({
  domain,
}: In["tracking"]["getTrackingStatus"]): Promise<Out["tracking"]["getTrackingStatus"]> {
  const match = domainsState.find(
    (item) => item.archivedAt == null && item.domainName.toLowerCase() === domain.toLowerCase(),
  );
  return match
    ? { id: match.id, verified: match.verified, verificationMethod: match.verificationMethod }
    : null;
}

export const getTrackingStatusQuery =
  vi.fn<
    (input: In["tracking"]["getTrackingStatus"]) => Promise<Out["tracking"]["getTrackingStatus"]>
  >(defaultTrackingStatus);

const DEFAULT_SUBSCRIPTION: Out["user"]["getSubscription"] = {
  plan: "pro",
  planQuota: 100,
  endsAt: null,
  activeCount: 0,
  archivedCount: 0,
  canAddMore: true,
};

let subscriptionState: Out["user"]["getSubscription"] = { ...DEFAULT_SUBSCRIPTION };

async function defaultGetSubscription(): Promise<Out["user"]["getSubscription"]> {
  return subscriptionState;
}

export const getSubscriptionQuery =
  vi.fn<() => Promise<Out["user"]["getSubscription"]>>(defaultGetSubscription);

async function defaultAddDomain({
  domain,
}: In["tracking"]["addDomain"]): Promise<Out["tracking"]["addDomain"]> {
  return { id: "domain-new", domain, verificationToken: "token-new", resumed: false };
}

export const addDomainMutation =
  vi.fn<(input: In["tracking"]["addDomain"]) => Promise<Out["tracking"]["addDomain"]>>(
    defaultAddDomain,
  );

async function defaultVerifyDomain(): Promise<Out["tracking"]["verifyDomain"]> {
  return { verified: true, method: "dns_txt" };
}

export const verifyDomainMutation =
  vi.fn<(input: In["tracking"]["verifyDomain"]) => Promise<Out["tracking"]["verifyDomain"]>>(
    defaultVerifyDomain,
  );

async function defaultGetVerificationData(): Promise<Out["tracking"]["getVerificationData"]> {
  return {
    domain: "pending.dev",
    verificationToken: "token-pending",
    verificationMethod: "dns_txt",
  };
}

export const getVerificationDataQuery = vi.fn<
  (input: In["tracking"]["getVerificationData"]) => Promise<Out["tracking"]["getVerificationData"]>
>(defaultGetVerificationData);

async function defaultRemoveDomain(): Promise<Out["tracking"]["removeDomain"]> {
  return { success: true };
}

export const removeDomainMutation =
  vi.fn<(input: In["tracking"]["removeDomain"]) => Promise<Out["tracking"]["removeDomain"]>>(
    defaultRemoveDomain,
  );

async function defaultArchiveDomain(): Promise<Out["tracking"]["archiveDomain"]> {
  return { success: true, archivedAt: new Date() };
}

export const archiveDomainMutation =
  vi.fn<(input: In["tracking"]["archiveDomain"]) => Promise<Out["tracking"]["archiveDomain"]>>(
    defaultArchiveDomain,
  );

async function defaultUnarchiveDomain(): Promise<Out["tracking"]["unarchiveDomain"]> {
  return { success: true };
}

export const unarchiveDomainMutation =
  vi.fn<(input: In["tracking"]["unarchiveDomain"]) => Promise<Out["tracking"]["unarchiveDomain"]>>(
    defaultUnarchiveDomain,
  );

async function defaultBulkArchiveDomains({
  trackedDomainIds,
}: In["tracking"]["bulkArchiveDomains"]): Promise<Out["tracking"]["bulkArchiveDomains"]> {
  return { successCount: trackedDomainIds.length, failedCount: 0 };
}

export const bulkArchiveDomainsMutation =
  vi.fn<
    (input: In["tracking"]["bulkArchiveDomains"]) => Promise<Out["tracking"]["bulkArchiveDomains"]>
  >(defaultBulkArchiveDomains);

async function defaultBulkRemoveDomains({
  trackedDomainIds,
}: In["tracking"]["bulkRemoveDomains"]): Promise<Out["tracking"]["bulkRemoveDomains"]> {
  return { successCount: trackedDomainIds.length, failedCount: 0 };
}

export const bulkRemoveDomainsMutation =
  vi.fn<
    (input: In["tracking"]["bulkRemoveDomains"]) => Promise<Out["tracking"]["bulkRemoveDomains"]>
  >(defaultBulkRemoveDomains);

async function defaultBulkMuteDomains({
  trackedDomainIds,
}: In["tracking"]["bulkMuteDomains"]): Promise<Out["tracking"]["bulkMuteDomains"]> {
  return { successCount: trackedDomainIds.length, failedCount: 0 };
}

export const bulkMuteDomainsMutation =
  vi.fn<(input: In["tracking"]["bulkMuteDomains"]) => Promise<Out["tracking"]["bulkMuteDomains"]>>(
    defaultBulkMuteDomains,
  );

async function defaultMuteDomain({
  trackedDomainId,
  muted,
}: In["tracking"]["muteDomain"]): Promise<Out["tracking"]["muteDomain"]> {
  return { id: trackedDomainId, muted };
}

export const muteDomainMutation =
  vi.fn<(input: In["tracking"]["muteDomain"]) => Promise<Out["tracking"]["muteDomain"]>>(
    defaultMuteDomain,
  );

async function defaultSendVerificationInstructions(): Promise<
  Out["tracking"]["sendVerificationInstructions"]
> {
  return { success: true };
}

export const sendVerificationInstructionsMutation = vi.fn<
  (
    input: In["tracking"]["sendVerificationInstructions"],
  ) => Promise<Out["tracking"]["sendVerificationInstructions"]>
>(defaultSendVerificationInstructions);

export const CALENDAR_FEED_URL = "https://cal.example.test/feed/token.ics";
export const CALENDAR_FEED_ROTATED_URL = "https://cal.example.test/feed/rotated.ics";

let calendarFeedState: Out["user"]["getCalendarFeed"] = { enabled: false };

export function setCalendarFeedState(data: Out["user"]["getCalendarFeed"]) {
  calendarFeedState = data;
}

async function defaultGetCalendarFeed(): Promise<Out["user"]["getCalendarFeed"]> {
  return calendarFeedState;
}

export const getCalendarFeedQuery =
  vi.fn<() => Promise<Out["user"]["getCalendarFeed"]>>(defaultGetCalendarFeed);

async function defaultEnableCalendarFeed(): Promise<Out["user"]["enableCalendarFeed"]> {
  const feedUrl = CALENDAR_FEED_URL;
  calendarFeedState = { enabled: true, feedUrl, lastAccessedAt: null };
  return { feedUrl, createdAt: new Date() };
}

export const enableCalendarFeedMutation =
  vi.fn<() => Promise<Out["user"]["enableCalendarFeed"]>>(defaultEnableCalendarFeed);

async function defaultRotateCalendarFeedToken(): Promise<Out["user"]["rotateCalendarFeedToken"]> {
  const feedUrl = CALENDAR_FEED_ROTATED_URL;
  calendarFeedState = {
    enabled: true,
    feedUrl,
    lastAccessedAt: calendarFeedState.lastAccessedAt ?? null,
  };
  return { feedUrl, rotatedAt: new Date() };
}

export const rotateCalendarFeedTokenMutation = vi.fn<
  () => Promise<Out["user"]["rotateCalendarFeedToken"]>
>(defaultRotateCalendarFeedToken);

async function defaultDeleteCalendarFeed(): Promise<Out["user"]["deleteCalendarFeed"]> {
  calendarFeedState = { enabled: false };
  return { success: true };
}

export const deleteCalendarFeedMutation =
  vi.fn<() => Promise<Out["user"]["deleteCalendarFeed"]>>(defaultDeleteCalendarFeed);

const NOTIFICATIONS_PAGE_SIZE = 20;

type NotificationsListInput = In["notifications"]["list"];
type NotificationFilter = NotificationsListInput["filter"];
type NotificationData = Out["notifications"]["list"]["items"][number];

/**
 * Widens the UI-facing `NotificationData` (what components render and fixtures
 * build) to the full row the `notifications.list` procedure returns.
 */
export function toNotificationRow(item: NotificationItem): NotificationData {
  return {
    userId: "user-1",
    data: null,
    channels: ["in-app"],
    resendId: null,
    dedupeKey: null,
    ...item,
  };
}

let notificationsState: NotificationData[] = [];

export function setNotificationsState(items: NotificationItem[]) {
  notificationsState = items.map(toNotificationRow);
}

function markNotificationRead(item: NotificationData, now: Date): NotificationData {
  return item.readAt ? item : Object.assign({}, item, { readAt: now });
}

function filteredNotifications(filter: NotificationFilter) {
  if (filter === "unread") {
    return notificationsState.filter((item) => item.readAt === null);
  }
  if (filter === "read") {
    return notificationsState.filter((item) => item.readAt !== null);
  }
  return notificationsState;
}

async function defaultListNotifications(
  input: NotificationsListInput,
): Promise<Out["notifications"]["list"]> {
  const limit = input.limit ?? NOTIFICATIONS_PAGE_SIZE;
  const items = filteredNotifications(input.filter);
  let start = 0;
  if (input.cursor) {
    const cursorIndex = items.findIndex((item) => item.id === input.cursor);
    start = cursorIndex >= 0 ? cursorIndex + 1 : 0;
  }
  const page = items.slice(start, start + limit + 1);
  let nextCursor: string | undefined;
  if (page.length > limit) {
    nextCursor = page.pop()?.id;
  }
  return { items: page, nextCursor };
}

export const listNotificationsQuery =
  vi.fn<(input: NotificationsListInput) => Promise<Out["notifications"]["list"]>>(
    defaultListNotifications,
  );

async function defaultUnreadCount(): Promise<Out["notifications"]["unreadCount"]> {
  return filteredNotifications("unread").length;
}

export const unreadCountQuery =
  vi.fn<() => Promise<Out["notifications"]["unreadCount"]>>(defaultUnreadCount);

async function defaultMarkRead({
  id,
}: In["notifications"]["markRead"]): Promise<Out["notifications"]["markRead"]> {
  const now = new Date();
  notificationsState = notificationsState.map((item) =>
    item.id === id ? markNotificationRead(item, now) : item,
  );
  return { success: true };
}

export const markReadMutation =
  vi.fn<(input: In["notifications"]["markRead"]) => Promise<Out["notifications"]["markRead"]>>(
    defaultMarkRead,
  );

async function defaultMarkAllRead(
  input?: In["notifications"]["markAllRead"],
): Promise<Out["notifications"]["markAllRead"]> {
  const now = new Date();
  const upTo = input?.upTo;
  const shouldMark = (item: NotificationData) =>
    item.readAt === null && (!upTo || item.sentAt.getTime() <= upTo.getTime());
  const count = notificationsState.filter(shouldMark).length;
  notificationsState = notificationsState.map((item) =>
    shouldMark(item) ? markNotificationRead(item, now) : item,
  );
  return { count };
}

export const markAllReadMutation =
  vi.fn<
    (input?: In["notifications"]["markAllRead"]) => Promise<Out["notifications"]["markAllRead"]>
  >(defaultMarkAllRead);

export function resetTrpcMocks() {
  domainsState = [];
  listDomainsQuery.mockReset();
  listDomainsQuery.mockImplementation(defaultListDomains);
  getTrackingStatusQuery.mockReset();
  getTrackingStatusQuery.mockImplementation(defaultTrackingStatus);

  subscriptionState = { ...DEFAULT_SUBSCRIPTION };
  getSubscriptionQuery.mockReset();
  getSubscriptionQuery.mockImplementation(defaultGetSubscription);

  addDomainMutation.mockReset();
  addDomainMutation.mockImplementation(defaultAddDomain);

  verifyDomainMutation.mockReset();
  verifyDomainMutation.mockImplementation(defaultVerifyDomain);

  getVerificationDataQuery.mockReset();
  getVerificationDataQuery.mockImplementation(defaultGetVerificationData);

  removeDomainMutation.mockReset();
  removeDomainMutation.mockImplementation(defaultRemoveDomain);

  archiveDomainMutation.mockReset();
  archiveDomainMutation.mockImplementation(defaultArchiveDomain);

  unarchiveDomainMutation.mockReset();
  unarchiveDomainMutation.mockImplementation(defaultUnarchiveDomain);

  bulkArchiveDomainsMutation.mockReset();
  bulkArchiveDomainsMutation.mockImplementation(defaultBulkArchiveDomains);

  bulkRemoveDomainsMutation.mockReset();
  bulkRemoveDomainsMutation.mockImplementation(defaultBulkRemoveDomains);

  bulkMuteDomainsMutation.mockReset();
  bulkMuteDomainsMutation.mockImplementation(defaultBulkMuteDomains);

  muteDomainMutation.mockReset();
  muteDomainMutation.mockImplementation(defaultMuteDomain);

  sendVerificationInstructionsMutation.mockReset();
  sendVerificationInstructionsMutation.mockImplementation(defaultSendVerificationInstructions);

  calendarFeedState = { enabled: false };
  getCalendarFeedQuery.mockReset();
  getCalendarFeedQuery.mockImplementation(defaultGetCalendarFeed);

  enableCalendarFeedMutation.mockReset();
  enableCalendarFeedMutation.mockImplementation(defaultEnableCalendarFeed);

  rotateCalendarFeedTokenMutation.mockReset();
  rotateCalendarFeedTokenMutation.mockImplementation(defaultRotateCalendarFeedToken);

  deleteCalendarFeedMutation.mockReset();
  deleteCalendarFeedMutation.mockImplementation(defaultDeleteCalendarFeed);

  notificationsState = [];
  listNotificationsQuery.mockReset();
  listNotificationsQuery.mockImplementation(defaultListNotifications);

  unreadCountQuery.mockReset();
  unreadCountQuery.mockImplementation(defaultUnreadCount);

  markReadMutation.mockReset();
  markReadMutation.mockImplementation(defaultMarkRead);

  markAllReadMutation.mockReset();
  markAllReadMutation.mockImplementation(defaultMarkAllRead);
}

/**
 * Routes every tRPC call made through the real options proxy to the `vi.fn`
 * handlers above. Handlers are invoked through arrow wrappers so
 * `mockReset`/`mockImplementation` in tests keep working. A procedure without
 * an entry fails loudly.
 */
const procedures: Record<string, (input: unknown) => Promise<unknown>> = {
  "tracking.listDomains": (input) => listDomainsQuery(input as In["tracking"]["listDomains"]),
  "tracking.getTrackingStatus": (input) =>
    getTrackingStatusQuery(input as In["tracking"]["getTrackingStatus"]),
  "tracking.getVerificationData": (input) =>
    getVerificationDataQuery(input as In["tracking"]["getVerificationData"]),
  "tracking.addDomain": (input) => addDomainMutation(input as In["tracking"]["addDomain"]),
  "tracking.verifyDomain": (input) => verifyDomainMutation(input as In["tracking"]["verifyDomain"]),
  "tracking.removeDomain": (input) => removeDomainMutation(input as In["tracking"]["removeDomain"]),
  "tracking.archiveDomain": (input) =>
    archiveDomainMutation(input as In["tracking"]["archiveDomain"]),
  "tracking.unarchiveDomain": (input) =>
    unarchiveDomainMutation(input as In["tracking"]["unarchiveDomain"]),
  "tracking.bulkArchiveDomains": (input) =>
    bulkArchiveDomainsMutation(input as In["tracking"]["bulkArchiveDomains"]),
  "tracking.bulkRemoveDomains": (input) =>
    bulkRemoveDomainsMutation(input as In["tracking"]["bulkRemoveDomains"]),
  "tracking.bulkMuteDomains": (input) =>
    bulkMuteDomainsMutation(input as In["tracking"]["bulkMuteDomains"]),
  "tracking.muteDomain": (input) => muteDomainMutation(input as In["tracking"]["muteDomain"]),
  "tracking.sendVerificationInstructions": (input) =>
    sendVerificationInstructionsMutation(input as In["tracking"]["sendVerificationInstructions"]),
  "user.getSubscription": () => getSubscriptionQuery(),
  "user.getCalendarFeed": () => getCalendarFeedQuery(),
  "user.enableCalendarFeed": () => enableCalendarFeedMutation(),
  "user.rotateCalendarFeedToken": () => rotateCalendarFeedTokenMutation(),
  "user.deleteCalendarFeed": () => deleteCalendarFeedMutation(),
  "notifications.list": (input) => listNotificationsQuery(input as In["notifications"]["list"]),
  "notifications.unreadCount": () => unreadCountQuery(),
  "notifications.markRead": (input) => markReadMutation(input as In["notifications"]["markRead"]),
  "notifications.markAllRead": (input) =>
    markAllReadMutation(input as In["notifications"]["markAllRead"]),
};

const testLink: TRPCLink<AppRouter> = () => {
  return ({ op }) =>
    observable((observer) => {
      const handler = procedures[op.path];
      if (!handler) {
        observer.error(TRPCClientError.from(new Error(`No test handler for ${op.path}`)));
        return;
      }
      void (async () => {
        try {
          const data = await handler(op.input);
          observer.next({ result: { data } });
          observer.complete();
        } catch (err) {
          observer.error(TRPCClientError.from(err as Error));
        }
      })();
    });
};

const client = createTRPCClient<AppRouter>({ links: [testLink] });

export function useTRPC() {
  const queryClient = useQueryClient();
  return useMemo(() => createTRPCOptionsProxy<AppRouter>({ client, queryClient }), [queryClient]);
}

/** Real query keys/filters for seeding and reading the cache in tests. */
export const trpcKeys = createTRPCOptionsProxy<AppRouter>({
  client,
  queryClient: () => {
    throw new Error("trpcKeys is for keys and filters only");
  },
});

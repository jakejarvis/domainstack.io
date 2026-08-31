import { vi } from "vitest";

import type { VerificationMethod } from "@domainstack/constants";
import type { NotificationData, TrackedDomainWithDetails } from "@domainstack/types";

type AddDomainInput = { domain: string };
type AddDomainResult = {
  id: string;
  domain: string;
  verificationToken: string;
  resumed: boolean;
};

type VerifyDomainInput = { trackedDomainId: string; method?: VerificationMethod };
type VerifyDomainResult = { verified: boolean; method: VerificationMethod | null };

type GetVerificationDataInput = { trackedDomainId: string };
type GetVerificationDataResult = {
  domain: string;
  verificationToken: string;
  verificationMethod: VerificationMethod | null;
};

type TrackedDomainIdInput = { trackedDomainId: string };
type BulkDomainIdsInput = { trackedDomainIds: string[] };
type BulkSetMutedInput = { trackedDomainIds: string[]; muted: boolean };
type BulkMutationResult = { successCount: number; failedCount: number };
type SetMutedInput = { trackedDomainId: string; muted: boolean };
type SendVerificationInstructionsInput = { trackedDomainId: string; recipientEmail: string };

export const DOMAINS_QUERY_KEY = ["tracking", "listDomains"] as const;
export const SUBSCRIPTION_QUERY_KEY = ["user", "getSubscription"] as const;

type ListDomainsInput = { includeArchived?: boolean } | undefined;

function listDomainsQueryKey(input?: ListDomainsInput) {
  return input === undefined ? DOMAINS_QUERY_KEY : ([...DOMAINS_QUERY_KEY, input] as const);
}

function queryFilterFor(queryKey: readonly unknown[]) {
  return { queryKey };
}

function mutationOptionsFor<TArgs, TResult>(mutationFn: (args: TArgs) => Promise<TResult>) {
  return (opts?: object) => ({ ...opts, mutationFn });
}

let domainsState: TrackedDomainWithDetails[] = [];

export function setDomainsState(items: TrackedDomainWithDetails[]) {
  domainsState = items.map((item) => ({ ...item }));
}

export function getDomainsState() {
  return domainsState;
}

function defaultListDomains(input?: ListDomainsInput): Promise<TrackedDomainWithDetails[]> {
  const includeArchived = input?.includeArchived ?? false;
  if (includeArchived) {
    return Promise.resolve(domainsState);
  }
  return Promise.resolve(domainsState.filter((item) => item.archivedAt == null));
}

export const listDomainsQuery =
  vi.fn<(input?: ListDomainsInput) => Promise<TrackedDomainWithDetails[]>>(defaultListDomains);

export type SubscriptionData = {
  plan: "free" | "pro";
  planQuota: number;
  endsAt: Date | null;
  activeCount: number;
  archivedCount: number;
  canAddMore: boolean;
};

const DEFAULT_SUBSCRIPTION: SubscriptionData = {
  plan: "pro",
  planQuota: 100,
  endsAt: null,
  activeCount: 0,
  archivedCount: 0,
  canAddMore: true,
};

let subscriptionState: SubscriptionData = { ...DEFAULT_SUBSCRIPTION };

export function setSubscriptionState(data: SubscriptionData) {
  subscriptionState = { ...data };
}

export function getSubscriptionState() {
  return subscriptionState;
}

export const getSubscriptionQuery = vi.fn<() => Promise<SubscriptionData>>(
  async () => subscriptionState,
);

export const addDomainMutation = vi.fn<(input: AddDomainInput) => Promise<AddDomainResult>>(
  async ({ domain }) => ({
    id: "domain-new",
    domain,
    verificationToken: "token-new",
    resumed: false,
  }),
);

export const verifyDomainMutation = vi.fn<
  (input: VerifyDomainInput) => Promise<VerifyDomainResult>
>(async () => ({
  verified: true,
  method: "dns_txt",
}));

export const getVerificationDataQuery = vi.fn<
  (input: GetVerificationDataInput) => Promise<GetVerificationDataResult>
>(async () => ({
  domain: "pending.dev",
  verificationToken: "token-pending",
  verificationMethod: "dns_txt",
}));

export const removeDomainMutation = vi.fn<(input: TrackedDomainIdInput) => Promise<{ ok: true }>>(
  async () => ({ ok: true }),
);

export const archiveDomainMutation = vi.fn<(input: TrackedDomainIdInput) => Promise<{ ok: true }>>(
  async () => ({ ok: true }),
);

export const unarchiveDomainMutation = vi.fn<
  (input: TrackedDomainIdInput) => Promise<{ ok: true }>
>(async () => ({ ok: true }));

export const bulkArchiveDomainsMutation = vi.fn<
  (input: BulkDomainIdsInput) => Promise<BulkMutationResult>
>(async ({ trackedDomainIds }) => ({
  successCount: trackedDomainIds.length,
  failedCount: 0,
}));

export const bulkRemoveDomainsMutation = vi.fn<
  (input: BulkDomainIdsInput) => Promise<BulkMutationResult>
>(async ({ trackedDomainIds }) => ({
  successCount: trackedDomainIds.length,
  failedCount: 0,
}));

export const bulkSetMutedMutation = vi.fn<
  (input: BulkSetMutedInput) => Promise<BulkMutationResult>
>(async ({ trackedDomainIds }) => ({
  successCount: trackedDomainIds.length,
  failedCount: 0,
}));

export const setDomainMutedMutation = vi.fn<(input: SetMutedInput) => Promise<{ ok: true }>>(
  async () => ({ ok: true }),
);

export const sendVerificationInstructionsMutation = vi.fn<
  (input: SendVerificationInstructionsInput) => Promise<{ sent: boolean }>
>(async () => ({ sent: true }));

export const CALENDAR_FEED_QUERY_KEY = ["user", "getCalendarFeed"] as const;
export const CALENDAR_FEED_URL = "https://cal.example.test/feed/token.ics";
export const CALENDAR_FEED_ROTATED_URL = "https://cal.example.test/feed/rotated.ics";

export type CalendarFeedData =
  | { enabled: false }
  | { enabled: true; feedUrl: string; lastAccessedAt: Date | null }
  | { enabled: false; feedUrl: string; lastAccessedAt: Date | null };

let calendarFeedState: CalendarFeedData = { enabled: false };

export function setCalendarFeedState(data: CalendarFeedData) {
  calendarFeedState = data;
}

export function getCalendarFeedState() {
  return calendarFeedState;
}

export const getCalendarFeedQuery = vi.fn<() => Promise<CalendarFeedData>>(
  async () => calendarFeedState,
);

export const enableCalendarFeedMutation = vi.fn<
  () => Promise<{ feedUrl: string; createdAt: Date }>
>(async () => {
  const feedUrl = CALENDAR_FEED_URL;
  calendarFeedState = { enabled: true, feedUrl, lastAccessedAt: null };
  return { feedUrl, createdAt: new Date() };
});

export const disableCalendarFeedMutation = vi.fn<() => Promise<{ success: true }>>(async () => {
  if ("feedUrl" in calendarFeedState) {
    calendarFeedState = { ...calendarFeedState, enabled: false };
  } else {
    calendarFeedState = { enabled: false };
  }
  return { success: true };
});

export const rotateCalendarFeedTokenMutation = vi.fn<
  () => Promise<{ feedUrl: string; rotatedAt: Date }>
>(async () => {
  const feedUrl = CALENDAR_FEED_ROTATED_URL;
  calendarFeedState = {
    enabled: true,
    feedUrl,
    lastAccessedAt: "lastAccessedAt" in calendarFeedState ? calendarFeedState.lastAccessedAt : null,
  };
  return { feedUrl, rotatedAt: new Date() };
});

export const deleteCalendarFeedMutation = vi.fn<() => Promise<{ success: true }>>(async () => {
  calendarFeedState = { enabled: false };
  return { success: true };
});

export const NOTIFICATIONS_UNREAD_COUNT_QUERY_KEY = ["notifications", "unreadCount"] as const;
export const NOTIFICATIONS_PAGE_SIZE = 20;

type NotificationFilter = "unread" | "read" | "all";
type NotificationsListInput = {
  limit?: number;
  cursor?: string;
  filter: NotificationFilter;
};
type NotificationsListResult = { items: NotificationData[]; nextCursor?: string };

export function notificationsListQueryKey(
  filter: NotificationFilter,
  limit = NOTIFICATIONS_PAGE_SIZE,
) {
  return ["notifications", "list", { limit, filter }] as const;
}

let notificationsState: NotificationData[] = [];

export function setNotificationsState(items: NotificationData[]) {
  notificationsState = items.map((item) => ({ ...item }));
}

export function getNotificationsState() {
  return notificationsState;
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
): Promise<NotificationsListResult> {
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
  vi.fn<(input: NotificationsListInput) => Promise<NotificationsListResult>>(
    defaultListNotifications,
  );

export const unreadCountQuery = vi.fn<() => Promise<number>>(
  async () => filteredNotifications("unread").length,
);

export const markReadMutation = vi.fn<(input: { id: string }) => Promise<{ success: true }>>(
  async ({ id }) => {
    const now = new Date();
    notificationsState = notificationsState.map((item) =>
      item.id === id ? markNotificationRead(item, now) : item,
    );
    return { success: true };
  },
);

export const markAllReadMutation = vi.fn<() => Promise<{ count: number }>>(async () => {
  const now = new Date();
  const unreadCount = filteredNotifications("unread").length;
  notificationsState = notificationsState.map((item) => markNotificationRead(item, now));
  return { count: unreadCount };
});

export function resetTrpcMocks() {
  domainsState = [];
  listDomainsQuery.mockReset();
  listDomainsQuery.mockImplementation(defaultListDomains);

  subscriptionState = { ...DEFAULT_SUBSCRIPTION };
  getSubscriptionQuery.mockReset();
  getSubscriptionQuery.mockImplementation(async () => subscriptionState);

  addDomainMutation.mockReset();
  addDomainMutation.mockImplementation(async ({ domain }) => ({
    id: "domain-new",
    domain,
    verificationToken: "token-new",
    resumed: false,
  }));

  verifyDomainMutation.mockReset();
  verifyDomainMutation.mockImplementation(async () => ({
    verified: true,
    method: "dns_txt",
  }));

  getVerificationDataQuery.mockReset();
  getVerificationDataQuery.mockImplementation(async () => ({
    domain: "pending.dev",
    verificationToken: "token-pending",
    verificationMethod: "dns_txt",
  }));

  removeDomainMutation.mockReset();
  removeDomainMutation.mockImplementation(async () => ({ ok: true }));

  archiveDomainMutation.mockReset();
  archiveDomainMutation.mockImplementation(async () => ({ ok: true }));

  unarchiveDomainMutation.mockReset();
  unarchiveDomainMutation.mockImplementation(async () => ({ ok: true }));

  bulkArchiveDomainsMutation.mockReset();
  bulkArchiveDomainsMutation.mockImplementation(async ({ trackedDomainIds }) => ({
    successCount: trackedDomainIds.length,
    failedCount: 0,
  }));

  bulkRemoveDomainsMutation.mockReset();
  bulkRemoveDomainsMutation.mockImplementation(async ({ trackedDomainIds }) => ({
    successCount: trackedDomainIds.length,
    failedCount: 0,
  }));

  bulkSetMutedMutation.mockReset();
  bulkSetMutedMutation.mockImplementation(async ({ trackedDomainIds }) => ({
    successCount: trackedDomainIds.length,
    failedCount: 0,
  }));

  setDomainMutedMutation.mockReset();
  setDomainMutedMutation.mockImplementation(async () => ({ ok: true }));

  sendVerificationInstructionsMutation.mockReset();
  sendVerificationInstructionsMutation.mockImplementation(async () => ({ sent: true }));

  calendarFeedState = { enabled: false };
  getCalendarFeedQuery.mockReset();
  getCalendarFeedQuery.mockImplementation(async () => calendarFeedState);

  enableCalendarFeedMutation.mockReset();
  enableCalendarFeedMutation.mockImplementation(async () => {
    const feedUrl = CALENDAR_FEED_URL;
    calendarFeedState = { enabled: true, feedUrl, lastAccessedAt: null };
    return { feedUrl, createdAt: new Date() };
  });

  disableCalendarFeedMutation.mockReset();
  disableCalendarFeedMutation.mockImplementation(async () => {
    if ("feedUrl" in calendarFeedState) {
      calendarFeedState = { ...calendarFeedState, enabled: false };
    } else {
      calendarFeedState = { enabled: false };
    }
    return { success: true };
  });

  rotateCalendarFeedTokenMutation.mockReset();
  rotateCalendarFeedTokenMutation.mockImplementation(async () => {
    const feedUrl = CALENDAR_FEED_ROTATED_URL;
    calendarFeedState = {
      enabled: true,
      feedUrl,
      lastAccessedAt:
        "lastAccessedAt" in calendarFeedState ? calendarFeedState.lastAccessedAt : null,
    };
    return { feedUrl, rotatedAt: new Date() };
  });

  deleteCalendarFeedMutation.mockReset();
  deleteCalendarFeedMutation.mockImplementation(async () => {
    calendarFeedState = { enabled: false };
    return { success: true };
  });

  notificationsState = [];
  listNotificationsQuery.mockReset();
  listNotificationsQuery.mockImplementation(defaultListNotifications);

  unreadCountQuery.mockReset();
  unreadCountQuery.mockImplementation(async () => filteredNotifications("unread").length);

  markReadMutation.mockReset();
  markReadMutation.mockImplementation(async ({ id }) => {
    const now = new Date();
    notificationsState = notificationsState.map((item) =>
      item.id === id ? markNotificationRead(item, now) : item,
    );
    return { success: true };
  });

  markAllReadMutation.mockReset();
  markAllReadMutation.mockImplementation(async () => {
    const now = new Date();
    const unreadCount = filteredNotifications("unread").length;
    notificationsState = notificationsState.map((item) => markNotificationRead(item, now));
    return { count: unreadCount };
  });
}

export function useTRPC() {
  return {
    tracking: {
      addDomain: {
        mutationOptions: mutationOptionsFor(addDomainMutation),
      },
      verifyDomain: {
        mutationOptions: mutationOptionsFor(verifyDomainMutation),
      },
      getVerificationData: {
        queryOptions: (input: GetVerificationDataInput) => ({
          queryKey: ["tracking", "getVerificationData", input] as const,
          queryFn: () => getVerificationDataQuery(input),
        }),
        queryFilter: (input?: GetVerificationDataInput) =>
          queryFilterFor(
            input
              ? (["tracking", "getVerificationData", input] as const)
              : (["tracking", "getVerificationData"] as const),
          ),
      },
      listDomains: {
        queryKey: listDomainsQueryKey,
        queryOptions: (input?: ListDomainsInput) => ({
          queryKey: listDomainsQueryKey(input),
          queryFn: () => listDomainsQuery(input),
        }),
        queryFilter: (input?: ListDomainsInput) => queryFilterFor(listDomainsQueryKey(input)),
      },
      removeDomain: {
        mutationOptions: mutationOptionsFor(removeDomainMutation),
      },
      archiveDomain: {
        mutationOptions: mutationOptionsFor(archiveDomainMutation),
      },
      unarchiveDomain: {
        mutationOptions: mutationOptionsFor(unarchiveDomainMutation),
      },
      bulkArchiveDomains: {
        mutationOptions: mutationOptionsFor(bulkArchiveDomainsMutation),
      },
      bulkRemoveDomains: {
        mutationOptions: mutationOptionsFor(bulkRemoveDomainsMutation),
      },
      bulkSetMuted: {
        mutationOptions: mutationOptionsFor(bulkSetMutedMutation),
      },
      sendVerificationInstructions: {
        mutationOptions: mutationOptionsFor(sendVerificationInstructionsMutation),
      },
    },
    user: {
      getSubscription: {
        queryKey: () => SUBSCRIPTION_QUERY_KEY,
        queryOptions: () => ({
          queryKey: SUBSCRIPTION_QUERY_KEY,
          queryFn: () => getSubscriptionQuery(),
        }),
        queryFilter: () => queryFilterFor(SUBSCRIPTION_QUERY_KEY),
      },
      setDomainMuted: {
        mutationOptions: mutationOptionsFor(setDomainMutedMutation),
      },
      getCalendarFeed: {
        queryKey: () => CALENDAR_FEED_QUERY_KEY,
        queryOptions: () => ({
          queryKey: CALENDAR_FEED_QUERY_KEY,
          queryFn: () => getCalendarFeedQuery(),
        }),
        queryFilter: () => queryFilterFor(CALENDAR_FEED_QUERY_KEY),
      },
      enableCalendarFeed: {
        mutationOptions: mutationOptionsFor(enableCalendarFeedMutation),
      },
      disableCalendarFeed: {
        mutationOptions: mutationOptionsFor(disableCalendarFeedMutation),
      },
      rotateCalendarFeedToken: {
        mutationOptions: mutationOptionsFor(rotateCalendarFeedTokenMutation),
      },
      deleteCalendarFeed: {
        mutationOptions: mutationOptionsFor(deleteCalendarFeedMutation),
      },
    },
    notifications: {
      list: {
        infiniteQueryOptions: (
          input: NotificationsListInput,
          opts?: {
            getNextPageParam?: (lastPage: NotificationsListResult) => string | undefined;
            refetchOnWindowFocus?: boolean;
            staleTime?: number;
            enabled?: boolean;
          },
        ) => ({
          queryKey: notificationsListQueryKey(input.filter, input.limit ?? NOTIFICATIONS_PAGE_SIZE),
          queryFn: ({ pageParam }: { pageParam?: unknown }) =>
            listNotificationsQuery({
              ...input,
              cursor: typeof pageParam === "string" ? pageParam : undefined,
            }),
          initialPageParam: undefined as string | undefined,
          getNextPageParam:
            opts?.getNextPageParam ?? ((lastPage: NotificationsListResult) => lastPage.nextCursor),
          refetchOnWindowFocus: opts?.refetchOnWindowFocus,
          staleTime: opts?.staleTime,
          enabled: opts?.enabled,
        }),
        queryFilter: () => queryFilterFor(["notifications", "list"] as const),
      },
      unreadCount: {
        queryKey: () => NOTIFICATIONS_UNREAD_COUNT_QUERY_KEY,
        queryOptions: () => ({
          queryKey: NOTIFICATIONS_UNREAD_COUNT_QUERY_KEY,
          queryFn: () => unreadCountQuery(),
        }),
        queryFilter: () => queryFilterFor(NOTIFICATIONS_UNREAD_COUNT_QUERY_KEY),
      },
      markRead: {
        mutationOptions: mutationOptionsFor(markReadMutation),
      },
      markAllRead: {
        mutationOptions: mutationOptionsFor(markAllReadMutation),
      },
    },
  };
}

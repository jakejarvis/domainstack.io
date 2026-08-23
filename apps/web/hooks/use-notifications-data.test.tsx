import { QueryClientProvider } from "@tanstack/react-query";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { toast } from "@domainstack/ui/toast";

vi.mock("@/lib/trpc/client", async () => {
  const { useTRPC } = await import("@/mocks/trpc");
  return { useTRPC };
});
vi.mock("@domainstack/ui/toast", () => ({
  toast: {
    add: vi.fn<(options?: { title?: string; description?: string; type?: string }) => void>(),
  },
}));

import {
  makeNotification,
  makeNotificationsInfiniteData,
} from "@/components/notifications/test-fixtures";
import { createTestQueryClient, renderHook, waitFor } from "@/mocks/react";
import {
  listNotificationsQuery,
  markAllReadMutation,
  markReadMutation,
  NOTIFICATIONS_UNREAD_COUNT_QUERY_KEY,
  notificationsListQueryKey,
  resetTrpcMocks,
  setNotificationsState,
} from "@/mocks/trpc";
import type { NotificationData } from "@domainstack/types";

import { useNotificationsData } from "./use-notifications-data";

const unreadAlpha = makeNotification({ id: "notif-alpha" });
const unreadBeta = makeNotification({
  id: "notif-beta",
  trackedDomainId: "domain-beta",
  title: "beta.io expires in 7 days",
  message: "Renew beta.io to keep it from expiring.",
});
const archivedGamma = makeNotification({
  id: "notif-gamma",
  trackedDomainId: "domain-gamma",
  title: "gamma.com expired",
  message: "gamma.com expired 10 days ago.",
  readAt: new Date("2026-08-22T12:00:00.000Z"),
});

function pageItems(
  queryClient: ReturnType<typeof createTestQueryClient>,
  filter: "unread" | "read",
) {
  const data = queryClient.getQueryData<{ pages: { items: NotificationData[] }[] }>(
    notificationsListQueryKey(filter),
  );
  return data?.pages.flatMap((page) => page.items) ?? [];
}

function renderNotificationsData(options?: {
  items?: NotificationData[];
  filter?: "unread" | "read";
  enabled?: boolean;
}) {
  const items = options?.items ?? [unreadAlpha, unreadBeta, archivedGamma];
  const queryClient = createTestQueryClient();
  setNotificationsState(items);

  queryClient.setQueryData(
    NOTIFICATIONS_UNREAD_COUNT_QUERY_KEY,
    items.filter((item) => item.readAt === null).length,
  );
  queryClient.setQueryData(
    notificationsListQueryKey("unread"),
    makeNotificationsInfiniteData(items.filter((item) => item.readAt === null)),
  );
  queryClient.setQueryData(
    notificationsListQueryKey("read"),
    makeNotificationsInfiniteData(items.filter((item) => item.readAt !== null)),
  );

  const view = renderHook(
    () =>
      useNotificationsData({
        filter: options?.filter ?? "unread",
        enabled: options?.enabled ?? true,
      }),
    {
      wrapper: ({ children }) => (
        <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
      ),
    },
  );

  return { ...view, queryClient };
}

describe("useNotificationsData", () => {
  beforeEach(() => {
    resetTrpcMocks();
    vi.mocked(toast.add).mockClear();
  });

  afterEach(() => {
    resetTrpcMocks();
  });

  it("does not fetch the list when the popover is closed", async () => {
    const { result } = renderNotificationsData({ enabled: false, items: [unreadAlpha] });

    await waitFor(() => {
      expect(result.current.count).toBe(1);
    });
    expect(listNotificationsQuery).not.toHaveBeenCalled();
  });

  it("markRead moves the item from inbox to archive and decrements the count", async () => {
    const { result, queryClient } = renderNotificationsData();

    result.current.markRead.mutate({ id: "notif-alpha" });

    await waitFor(() => {
      expect(pageItems(queryClient, "unread").map((item) => item.id)).toEqual(["notif-beta"]);
    });
    const archived = pageItems(queryClient, "read");
    expect(archived.map((item) => item.id)).toEqual(["notif-alpha", "notif-gamma"]);
    expect(archived[0]?.readAt).toBeInstanceOf(Date);
    expect(queryClient.getQueryData(NOTIFICATIONS_UNREAD_COUNT_QUERY_KEY)).toBe(1);
    expect(markReadMutation.mock.calls[0]?.[0]).toEqual({ id: "notif-alpha" });
  });

  it("rolls back and toasts when markRead fails", async () => {
    markReadMutation.mockRejectedValueOnce(new Error("nope"));
    const { result, queryClient } = renderNotificationsData();

    result.current.markRead.mutate({ id: "notif-alpha" });

    await waitFor(() => {
      expect(toast.add).toHaveBeenCalledWith({
        title: "Failed to mark notification as read",
        type: "error",
      });
    });
    expect(pageItems(queryClient, "unread").map((item) => item.id)).toEqual([
      "notif-alpha",
      "notif-beta",
    ]);
    expect(pageItems(queryClient, "read").map((item) => item.id)).toEqual(["notif-gamma"]);
    expect(queryClient.getQueryData(NOTIFICATIONS_UNREAD_COUNT_QUERY_KEY)).toBe(2);
  });

  it("markAllRead clears inbox and prepends those items onto archive", async () => {
    const { result, queryClient } = renderNotificationsData();

    result.current.markAllRead.mutate();

    await waitFor(() => {
      expect(pageItems(queryClient, "unread")).toEqual([]);
    });
    expect(pageItems(queryClient, "read").map((item) => item.id)).toEqual([
      "notif-alpha",
      "notif-beta",
      "notif-gamma",
    ]);
    expect(queryClient.getQueryData(NOTIFICATIONS_UNREAD_COUNT_QUERY_KEY)).toBe(0);
    expect(markAllReadMutation).toHaveBeenCalledOnce();
  });

  it("rolls back and toasts when markAllRead fails", async () => {
    markAllReadMutation.mockRejectedValueOnce(new Error("nope"));
    const { result, queryClient } = renderNotificationsData();

    result.current.markAllRead.mutate();

    await waitFor(() => {
      expect(toast.add).toHaveBeenCalledWith({
        title: "Failed to mark notifications as read",
        type: "error",
      });
    });
    expect(pageItems(queryClient, "unread").map((item) => item.id)).toEqual([
      "notif-alpha",
      "notif-beta",
    ]);
    expect(pageItems(queryClient, "read").map((item) => item.id)).toEqual(["notif-gamma"]);
    expect(queryClient.getQueryData(NOTIFICATIONS_UNREAD_COUNT_QUERY_KEY)).toBe(2);
  });
});

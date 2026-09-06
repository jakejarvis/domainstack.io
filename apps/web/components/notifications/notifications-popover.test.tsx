import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { page } from "vitest/browser";

const nav = vi.hoisted(() => ({
  push: vi.fn<(href: string) => void>(),
}));

vi.mock("@/lib/trpc/client", async () => {
  const { useTRPC } = await import("@/mocks/trpc");
  return { useTRPC };
});
vi.mock("@/hooks/use-router", () => ({
  useRouter: () => ({ push: nav.push }),
}));
vi.mock("sonner", () => ({
  toast: {
    success: vi.fn<(message?: string) => void>(),
    error: vi.fn<(message?: string) => void>(),
    info: vi.fn<(message?: string) => void>(),
  },
}));

import { NotificationsPopover } from "@/components/notifications/notifications-popover";
import {
  makeNotification,
  makeNotificationsInfiniteData,
} from "@/components/notifications/test-fixtures";
import { resetHydratedNow } from "@/hooks/use-hydrated-now";
import { createTestQueryClient, render } from "@/mocks/react";
import {
  listNotificationsQuery,
  markAllReadMutation,
  markReadMutation,
  NOTIFICATIONS_UNREAD_COUNT_QUERY_KEY,
  notificationsListQueryKey,
  resetTrpcMocks,
  setNotificationsState,
  unreadCountQuery,
} from "@/mocks/trpc";
import type { NotificationData } from "@domainstack/types";

const unreadAlpha = makeNotification({ id: "notif-alpha" });
const unreadGeneric = makeNotification({
  id: "notif-generic",
  trackedDomainId: null,
  type: "provider_change",
  title: "DNS provider changed",
  message: "A tracked domain changed DNS providers.",
});
const archivedGamma = makeNotification({
  id: "notif-gamma",
  title: "gamma.com expired",
  message: "gamma.com expired 10 days ago.",
  trackedDomainId: "domain-gamma",
  readAt: new Date("2026-08-22T12:00:00.000Z"),
});

function seedNotifications(
  queryClient: ReturnType<typeof createTestQueryClient>,
  items: NotificationData[],
) {
  setNotificationsState(items);
  const unread = items.filter((item) => item.readAt === null);
  const read = items.filter((item) => item.readAt !== null);
  queryClient.setQueryData(NOTIFICATIONS_UNREAD_COUNT_QUERY_KEY, unread.length);
  queryClient.setQueryData(
    notificationsListQueryKey("unread"),
    makeNotificationsInfiniteData(unread),
  );
  queryClient.setQueryData(notificationsListQueryKey("read"), makeNotificationsInfiniteData(read));
}

async function renderPopover(
  items: NotificationData[] = [unreadAlpha, unreadGeneric, archivedGamma],
) {
  const queryClient = createTestQueryClient();
  seedNotifications(queryClient, items);
  return render(<NotificationsPopover />, { queryClient });
}

async function openInbox() {
  await page.getByRole("button", { name: /Notifications/ }).click();
  await expect.element(page.getByRole("heading", { name: "Notifications" })).toBeInTheDocument();
}

describe("NotificationsPopover", () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    const now = new Date("2026-08-24T12:00:00.000Z");
    vi.setSystemTime(now);
    resetHydratedNow(now);
    resetTrpcMocks();
    nav.push.mockClear();
  });

  afterEach(() => {
    resetTrpcMocks();
    vi.useRealTimers();
  });

  it("shows a badge on the bell when there are unread notifications", async () => {
    await renderPopover([unreadAlpha]);

    const bell = page.getByRole("button", { name: "Notifications (1)" });
    await expect.element(bell).toBeInTheDocument();
    expect(bell.element().querySelector(".bg-destructive")).not.toBeNull();
  });

  it("hides the badge when there are no unread notifications", async () => {
    await renderPopover([]);

    const bell = page.getByRole("button", { name: "Notifications" });
    await expect.element(bell).toBeInTheDocument();
    expect(bell.element().querySelector(".bg-destructive")).toBeNull();
  });

  it("opens the inbox with unread copy and a relative timestamp", async () => {
    await renderPopover([unreadAlpha]);
    await openInbox();

    await expect
      .element(page.getByText("alpha.com expires in 7 days", { exact: true }))
      .toBeInTheDocument();
    await expect.element(page.getByRole("status", { name: "Unread" })).toBeInTheDocument();
    await expect.element(page.getByText("1 day ago", { exact: true })).toBeInTheDocument();
  });

  it("shows distinct empty copy for inbox and archive", async () => {
    await renderPopover([]);
    await openInbox();

    await expect.element(page.getByText("All caught up!", { exact: true })).toBeInTheDocument();
    await expect
      .element(page.getByText("No unread notifications", { exact: true }))
      .toBeInTheDocument();

    await page.getByRole("tab", { name: /Archive/ }).click();
    await expect
      .element(page.getByText("Nothing archived yet", { exact: true }))
      .toBeInTheDocument();
    await expect
      .element(page.getByText("Nothing to see here (yet…)", { exact: true }))
      .toBeInTheDocument();
    await expect.element(page.getByText("All caught up!", { exact: true })).not.toBeInTheDocument();
  });

  it("shows an error when the list fails to load", async () => {
    listNotificationsQuery.mockRejectedValue(new Error("nope"));
    const queryClient = createTestQueryClient();
    setNotificationsState([unreadAlpha]);
    queryClient.setQueryData(NOTIFICATIONS_UNREAD_COUNT_QUERY_KEY, 1);
    await render(<NotificationsPopover />, { queryClient });

    await openInbox();

    await expect.element(page.getByRole("alert")).toHaveTextContent("Failed to load notifications");
  });

  it("deep-links domain notifications and falls back to the dashboard", async () => {
    await renderPopover([unreadAlpha, unreadGeneric]);
    await openInbox();

    await expect
      .element(page.getByRole("link", { name: /alpha.com expires in 7 days/ }))
      .toHaveAttribute("href", "/dashboard?domainId=domain-alpha");
    await expect
      .element(page.getByRole("link", { name: /DNS provider changed/ }))
      .toHaveAttribute("href", "/dashboard");
  });

  it("marks only the clicked notification as read", async () => {
    await renderPopover([unreadAlpha, unreadGeneric]);
    await openInbox();

    const notificationLink = page.getByRole("link", { name: /alpha.com expires in 7 days/ });
    notificationLink.element().addEventListener("click", (event) => event.preventDefault(), true);
    await notificationLink.click();

    await vi.waitFor(() => {
      expect(markReadMutation.mock.calls[0]?.[0]).toEqual({ id: "notif-alpha" });
    });
    expect(markAllReadMutation).not.toHaveBeenCalled();
  });

  it("clears all unread notifications from Inbox", async () => {
    await renderPopover([unreadAlpha, unreadGeneric]);
    await openInbox();

    await page.getByRole("button", { name: "Clear all notifications" }).click();

    await vi.waitFor(() => {
      expect(markAllReadMutation).toHaveBeenCalledOnce();
    });
    await expect.element(page.getByText("All caught up!", { exact: true })).toBeInTheDocument();
    await expect.element(page.getByRole("button", { name: "Notifications" })).toBeInTheDocument();
  });

  it("marks remaining unread as read when switching to Archive", async () => {
    await renderPopover([unreadAlpha, archivedGamma]);
    await openInbox();

    await page.getByRole("tab", { name: /Archive/ }).click();

    await vi.waitFor(() => {
      expect(markAllReadMutation).toHaveBeenCalledOnce();
    });
    await expect
      .element(page.getByText("alpha.com expires in 7 days", { exact: true }))
      .toBeInTheDocument();
    await expect.element(page.getByText("gamma.com expired", { exact: true })).toBeInTheDocument();
  });

  it("marks remaining unread as read when closing Inbox", async () => {
    await renderPopover([unreadAlpha]);
    await openInbox();

    await page.getByRole("button", { name: /Notifications/ }).click();

    await vi.waitFor(() => {
      expect(markAllReadMutation).toHaveBeenCalledOnce();
    });
    await expect
      .element(page.getByRole("heading", { name: "Notifications" }))
      .not.toBeInTheDocument();
  });

  it("closes and navigates to settings", async () => {
    await renderPopover([unreadAlpha]);
    await openInbox();

    await page.getByRole("button", { name: "Notification settings" }).click();

    expect(nav.push).toHaveBeenCalledWith("/settings/notifications");
    await vi.waitFor(() => {
      expect(markAllReadMutation).toHaveBeenCalledOnce();
    });
    await expect
      .element(page.getByRole("heading", { name: "Notifications" }))
      .not.toBeInTheDocument();
  });

  it("caps the inbox badge at 99+", async () => {
    unreadCountQuery.mockResolvedValue(100);
    const queryClient = createTestQueryClient();
    setNotificationsState([unreadAlpha]);
    queryClient.setQueryData(NOTIFICATIONS_UNREAD_COUNT_QUERY_KEY, 100);
    queryClient.setQueryData(
      notificationsListQueryKey("unread"),
      makeNotificationsInfiniteData([unreadAlpha]),
    );
    queryClient.setQueryData(notificationsListQueryKey("read"), makeNotificationsInfiniteData([]));
    await render(<NotificationsPopover />, { queryClient });

    await expect
      .element(page.getByRole("button", { name: "Notifications (100)" }))
      .toBeInTheDocument();
    await openInbox();
    await expect
      .element(page.getByRole("tab", { name: /Inbox/ }).getByText("99+", { exact: true }))
      .toBeInTheDocument();
  });
});

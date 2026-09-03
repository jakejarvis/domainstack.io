import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

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
import { createTestQueryClient, render, screen, waitFor, within } from "@/mocks/react";
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

function renderPopover(items: NotificationData[] = [unreadAlpha, unreadGeneric, archivedGamma]) {
  const queryClient = createTestQueryClient();
  seedNotifications(queryClient, items);
  return render(<NotificationsPopover />, { queryClient });
}

function setupUser() {
  return userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
}

async function openInbox(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole("button", { name: /Notifications/ }));
  expect(await screen.findByRole("heading", { name: "Notifications" })).toBeInTheDocument();
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
    renderPopover([unreadAlpha]);

    const bell = await screen.findByRole("button", { name: "Notifications (1)" });
    expect(bell.querySelector(".bg-destructive")).not.toBeNull();
  });

  it("hides the badge when there are no unread notifications", async () => {
    renderPopover([]);

    const bell = await screen.findByRole("button", { name: "Notifications" });
    expect(bell.querySelector(".bg-destructive")).toBeNull();
  });

  it("opens the inbox with unread copy and a relative timestamp", async () => {
    const user = setupUser();
    renderPopover([unreadAlpha]);
    await openInbox(user);

    expect(screen.getByText("alpha.com expires in 7 days")).toBeInTheDocument();
    expect(screen.getByRole("status", { name: "Unread" })).toBeInTheDocument();
    expect(screen.getByText("1 day ago")).toBeInTheDocument();
  });

  it("shows distinct empty copy for inbox and archive", async () => {
    const user = setupUser();
    renderPopover([]);
    await openInbox(user);

    expect(screen.getByText("All caught up!")).toBeInTheDocument();
    expect(screen.getByText("No unread notifications")).toBeInTheDocument();

    await user.click(screen.getByRole("tab", { name: /Archive/ }));
    expect(await screen.findByText("Nothing archived yet")).toBeInTheDocument();
    expect(screen.getByText("Nothing to see here (yet…)")).toBeInTheDocument();
    expect(screen.queryByText("All caught up!")).not.toBeInTheDocument();
  });

  it("shows an error when the list fails to load", async () => {
    const user = setupUser();
    listNotificationsQuery.mockRejectedValue(new Error("nope"));
    const queryClient = createTestQueryClient();
    setNotificationsState([unreadAlpha]);
    queryClient.setQueryData(NOTIFICATIONS_UNREAD_COUNT_QUERY_KEY, 1);
    render(<NotificationsPopover />, { queryClient });

    await openInbox(user);

    expect(await screen.findByRole("alert")).toHaveTextContent("Failed to load notifications");
  });

  it("deep-links domain notifications and falls back to the dashboard", async () => {
    const user = setupUser();
    renderPopover([unreadAlpha, unreadGeneric]);
    await openInbox(user);

    expect(screen.getByRole("link", { name: /alpha.com expires in 7 days/ })).toHaveAttribute(
      "href",
      "/dashboard?domainId=domain-alpha",
    );
    expect(screen.getByRole("link", { name: /DNS provider changed/ })).toHaveAttribute(
      "href",
      "/dashboard",
    );
  });

  it("marks only the clicked notification as read", async () => {
    const user = setupUser();
    renderPopover([unreadAlpha, unreadGeneric]);
    await openInbox(user);

    const notificationLink = screen.getByRole("link", { name: /alpha.com expires in 7 days/ });
    notificationLink.addEventListener("click", (event) => event.preventDefault(), true);
    await user.click(notificationLink);

    await waitFor(() => {
      expect(markReadMutation.mock.calls[0]?.[0]).toEqual({ id: "notif-alpha" });
    });
    expect(markAllReadMutation).not.toHaveBeenCalled();
  });

  it("clears all unread notifications from Inbox", async () => {
    const user = setupUser();
    renderPopover([unreadAlpha, unreadGeneric]);
    await openInbox(user);

    await user.click(screen.getByRole("button", { name: "Clear all notifications" }));

    await waitFor(() => {
      expect(markAllReadMutation).toHaveBeenCalledOnce();
    });
    expect(await screen.findByText("All caught up!")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Notifications" })).toBeInTheDocument();
  });

  it("marks remaining unread as read when switching to Archive", async () => {
    const user = setupUser();
    renderPopover([unreadAlpha, archivedGamma]);
    await openInbox(user);

    await user.click(screen.getByRole("tab", { name: /Archive/ }));

    await waitFor(() => {
      expect(markAllReadMutation).toHaveBeenCalledOnce();
    });
    expect(await screen.findByText("alpha.com expires in 7 days")).toBeInTheDocument();
    expect(screen.getByText("gamma.com expired")).toBeInTheDocument();
  });

  it("marks remaining unread as read when closing Inbox", async () => {
    const user = setupUser();
    renderPopover([unreadAlpha]);
    await openInbox(user);

    await user.click(screen.getByRole("button", { name: /Notifications/ }));

    await waitFor(() => {
      expect(markAllReadMutation).toHaveBeenCalledOnce();
    });
    expect(screen.queryByRole("heading", { name: "Notifications" })).not.toBeInTheDocument();
  });

  it("closes and navigates to settings", async () => {
    const user = setupUser();
    renderPopover([unreadAlpha]);
    await openInbox(user);

    await user.click(screen.getByRole("button", { name: "Notification settings" }));

    expect(nav.push).toHaveBeenCalledWith("/settings/notifications");
    await waitFor(() => {
      expect(markAllReadMutation).toHaveBeenCalledOnce();
    });
    expect(screen.queryByRole("heading", { name: "Notifications" })).not.toBeInTheDocument();
  });

  it("caps the inbox badge at 99+", async () => {
    const user = setupUser();
    unreadCountQuery.mockResolvedValue(100);
    const queryClient = createTestQueryClient();
    setNotificationsState([unreadAlpha]);
    queryClient.setQueryData(NOTIFICATIONS_UNREAD_COUNT_QUERY_KEY, 100);
    queryClient.setQueryData(
      notificationsListQueryKey("unread"),
      makeNotificationsInfiniteData([unreadAlpha]),
    );
    queryClient.setQueryData(notificationsListQueryKey("read"), makeNotificationsInfiniteData([]));
    render(<NotificationsPopover />, { queryClient });

    expect(await screen.findByRole("button", { name: "Notifications (100)" })).toBeInTheDocument();
    await openInbox(user);
    expect(within(screen.getByRole("tab", { name: /Inbox/ })).getByText("99+")).toBeInTheDocument();
  });
});

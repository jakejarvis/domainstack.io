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

import { createTestQueryClient, renderHook, waitFor } from "@/mocks/react";
import {
  CALENDAR_FEED_QUERY_KEY,
  CALENDAR_FEED_ROTATED_URL,
  CALENDAR_FEED_URL,
  type CalendarFeedData,
  deleteCalendarFeedMutation,
  disableCalendarFeedMutation,
  enableCalendarFeedMutation,
  resetTrpcMocks,
  rotateCalendarFeedTokenMutation,
  setCalendarFeedState,
} from "@/mocks/trpc";

import { useCalendarFeed } from "./use-calendar-feed";

const enabledFeed: CalendarFeedData = {
  enabled: true,
  feedUrl: CALENDAR_FEED_URL,
  lastAccessedAt: null,
};

function getFeed(queryClient: ReturnType<typeof createTestQueryClient>) {
  return queryClient.getQueryData<CalendarFeedData>(CALENDAR_FEED_QUERY_KEY);
}

function renderCalendarFeed(feed: CalendarFeedData = { enabled: false }) {
  const queryClient = createTestQueryClient();
  setCalendarFeedState(feed);
  queryClient.setQueryData(CALENDAR_FEED_QUERY_KEY, feed);

  const view = renderHook(() => useCalendarFeed(), {
    wrapper: ({ children }) => (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    ),
  });

  return { ...view, queryClient };
}

describe("useCalendarFeed", () => {
  beforeEach(() => {
    resetTrpcMocks();
    vi.mocked(toast.add).mockClear();
  });

  afterEach(() => {
    resetTrpcMocks();
  });

  it("enables the feed and writes the new URL into cache", async () => {
    const { result, queryClient } = renderCalendarFeed();

    result.current.enable();

    await waitFor(() => {
      expect(getFeed(queryClient)).toEqual({
        enabled: true,
        feedUrl: CALENDAR_FEED_URL,
        lastAccessedAt: null,
      });
    });
    expect(result.current.isEnabled).toBe(true);
    expect(toast.add).toHaveBeenCalledWith({ title: "Calendar feed enabled", type: "success" });
    expect(enableCalendarFeedMutation).toHaveBeenCalledOnce();
  });

  it("toasts when enable fails", async () => {
    enableCalendarFeedMutation.mockRejectedValueOnce(new Error("nope"));
    const { result } = renderCalendarFeed();

    result.current.enable();

    await waitFor(() => {
      expect(toast.add).toHaveBeenCalledWith({
        title: "Failed to enable calendar feed",
        type: "error",
      });
    });
    expect(result.current.isEnabled).toBe(false);
  });

  it("disables the feed optimistically", async () => {
    const { result, queryClient } = renderCalendarFeed(enabledFeed);

    result.current.disable();

    await waitFor(() => {
      expect(getFeed(queryClient)?.enabled).toBe(false);
    });
    expect(result.current.isEnabled).toBe(false);
    expect(toast.add).toHaveBeenCalledWith({ title: "Calendar feed disabled", type: "success" });
    expect(disableCalendarFeedMutation).toHaveBeenCalledOnce();
  });

  it("rolls back and toasts when disable fails", async () => {
    disableCalendarFeedMutation.mockRejectedValueOnce(new Error("nope"));
    const { result, queryClient } = renderCalendarFeed(enabledFeed);

    result.current.disable();

    await waitFor(() => {
      expect(toast.add).toHaveBeenCalledWith({
        title: "Failed to disable calendar feed",
        type: "error",
      });
    });
    expect(getFeed(queryClient)).toEqual(enabledFeed);
    expect(result.current.isEnabled).toBe(true);
  });

  it("rotates the token and invalidates to the new URL", async () => {
    const { result, queryClient } = renderCalendarFeed(enabledFeed);

    result.current.rotate.mutate();

    await waitFor(() => {
      expect(getFeed(queryClient)).toEqual({
        enabled: true,
        feedUrl: CALENDAR_FEED_ROTATED_URL,
        lastAccessedAt: null,
      });
    });
    expect(toast.add).toHaveBeenCalledWith({
      title: "Calendar feed URL regenerated",
      type: "success",
    });
    expect(rotateCalendarFeedTokenMutation).toHaveBeenCalledOnce();
  });

  it("toasts when rotate fails", async () => {
    rotateCalendarFeedTokenMutation.mockRejectedValueOnce(new Error("nope"));
    const { result, queryClient } = renderCalendarFeed(enabledFeed);

    result.current.rotate.mutate();

    await waitFor(() => {
      expect(toast.add).toHaveBeenCalledWith({ title: "Failed to regenerate URL", type: "error" });
    });
    expect(getFeed(queryClient)).toEqual(enabledFeed);
  });

  it("deletes the feed optimistically", async () => {
    const { result, queryClient } = renderCalendarFeed(enabledFeed);

    result.current.deleteFeed.mutate();

    await waitFor(() => {
      expect(getFeed(queryClient)).toEqual({ enabled: false });
    });
    expect(result.current.isEnabled).toBe(false);
    expect(toast.add).toHaveBeenCalledWith({ title: "Calendar feed disabled", type: "success" });
    expect(deleteCalendarFeedMutation).toHaveBeenCalledOnce();
  });

  it("rolls back and toasts when delete fails", async () => {
    deleteCalendarFeedMutation.mockRejectedValueOnce(new Error("nope"));
    const { result, queryClient } = renderCalendarFeed(enabledFeed);

    result.current.deleteFeed.mutate();

    await waitFor(() => {
      expect(toast.add).toHaveBeenCalledWith({
        title: "Failed to disable calendar feed",
        type: "error",
      });
    });
    expect(getFeed(queryClient)).toEqual(enabledFeed);
    expect(result.current.isEnabled).toBe(true);
  });
});

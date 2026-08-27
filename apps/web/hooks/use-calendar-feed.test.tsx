import { QueryClientProvider } from "@tanstack/react-query";
import { toast } from "sonner";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/trpc/client", async () => {
  const { useTRPC } = await import("@/mocks/trpc");
  return { useTRPC };
});
vi.mock("sonner", () => ({
  toast: {
    success: vi.fn<(message?: string) => void>(),
    error: vi.fn<(message?: string) => void>(),
    info: vi.fn<(message?: string) => void>(),
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
    vi.mocked(toast.success).mockClear();
    vi.mocked(toast.error).mockClear();
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
    expect(toast.success).toHaveBeenCalledWith("Calendar feed enabled");
    expect(enableCalendarFeedMutation).toHaveBeenCalledOnce();
  });

  it("toasts when enable fails", async () => {
    enableCalendarFeedMutation.mockRejectedValueOnce(new Error("nope"));
    const { result } = renderCalendarFeed();

    result.current.enable();

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith("Failed to enable calendar feed");
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
    expect(toast.success).toHaveBeenCalledWith("Calendar feed disabled");
    expect(disableCalendarFeedMutation).toHaveBeenCalledOnce();
  });

  it("rolls back and toasts when disable fails", async () => {
    disableCalendarFeedMutation.mockRejectedValueOnce(new Error("nope"));
    const { result, queryClient } = renderCalendarFeed(enabledFeed);

    result.current.disable();

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith("Failed to disable calendar feed");
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
    expect(toast.success).toHaveBeenCalledWith("Calendar feed URL regenerated");
    expect(rotateCalendarFeedTokenMutation).toHaveBeenCalledOnce();
  });

  it("toasts when rotate fails", async () => {
    rotateCalendarFeedTokenMutation.mockRejectedValueOnce(new Error("nope"));
    const { result, queryClient } = renderCalendarFeed(enabledFeed);

    result.current.rotate.mutate();

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith("Failed to regenerate URL");
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
    expect(toast.success).toHaveBeenCalledWith("Calendar feed disabled");
    expect(deleteCalendarFeedMutation).toHaveBeenCalledOnce();
  });

  it("rolls back and toasts when delete fails", async () => {
    deleteCalendarFeedMutation.mockRejectedValueOnce(new Error("nope"));
    const { result, queryClient } = renderCalendarFeed(enabledFeed);

    result.current.deleteFeed.mutate();

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith("Failed to disable calendar feed");
    });
    expect(getFeed(queryClient)).toEqual(enabledFeed);
    expect(result.current.isEnabled).toBe(true);
  });
});

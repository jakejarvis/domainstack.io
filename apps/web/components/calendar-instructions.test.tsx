import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/trpc/client", async () => {
  const { useTRPC } = await import("@/mocks/trpc");
  return { useTRPC };
});
vi.mock("@domainstack/ui/toast", () => ({
  toast: {
    add: vi.fn<(options?: { title?: string; description?: string; type?: string }) => void>(),
  },
}));

import { createTestQueryClient, render, screen, waitFor, within } from "@/mocks/react";
import {
  CALENDAR_FEED_QUERY_KEY,
  CALENDAR_FEED_ROTATED_URL,
  CALENDAR_FEED_URL,
  type CalendarFeedData,
  deleteCalendarFeedMutation,
  enableCalendarFeedMutation,
  resetTrpcMocks,
  rotateCalendarFeedTokenMutation,
  setCalendarFeedState,
} from "@/mocks/trpc";

import { CalendarInstructions } from "./calendar-instructions";

const enabledFeed: CalendarFeedData = {
  enabled: true,
  feedUrl: CALENDAR_FEED_URL,
  lastAccessedAt: null,
};

function renderInstructions(feed: CalendarFeedData = { enabled: false }) {
  const queryClient = createTestQueryClient();
  setCalendarFeedState(feed);
  queryClient.setQueryData(CALENDAR_FEED_QUERY_KEY, feed);
  return render(<CalendarInstructions />, { queryClient });
}

describe("CalendarInstructions", () => {
  beforeEach(() => {
    resetTrpcMocks();
  });

  afterEach(() => {
    resetTrpcMocks();
  });

  it("enables the feed from the empty state", async () => {
    const user = userEvent.setup();
    renderInstructions();

    await user.click(screen.getByRole("button", { name: "Enable" }));

    await waitFor(() => {
      expect(enableCalendarFeedMutation).toHaveBeenCalledOnce();
    });
    expect(await screen.findByText("Treat this URL like a password!")).toBeInTheDocument();
    expect(screen.getByText(CALENDAR_FEED_URL)).toBeInTheDocument();
  });

  it("shows the feed URL and last-accessed copy when enabled", () => {
    renderInstructions({
      ...enabledFeed,
      lastAccessedAt: new Date(Date.now() - 2 * 60 * 60 * 1000),
    });

    expect(screen.getByText("Treat this URL like a password!")).toBeInTheDocument();
    expect(screen.getByText(CALENDAR_FEED_URL)).toBeInTheDocument();
    expect(screen.getByText(/Last accessed/)).toBeInTheDocument();
    expect(screen.queryByText("Not accessed yet.")).not.toBeInTheDocument();
  });

  it("says the feed has not been accessed yet", () => {
    renderInstructions(enabledFeed);

    expect(screen.getByText("Not accessed yet.")).toBeInTheDocument();
  });

  it("opens calendar apps from the Open In menu", async () => {
    const user = userEvent.setup();
    renderInstructions(enabledFeed);

    await user.click(screen.getByRole("button", { name: /Open In/ }));
    await screen.findByRole("menu");

    const webcal = CALENDAR_FEED_URL.replace("https://", "webcal://");
    expect(document.querySelector('a[href*="calendar.google.com"]')).toHaveAttribute(
      "href",
      `https://calendar.google.com/calendar/r?cid=${encodeURIComponent(webcal)}`,
    );
    expect(document.querySelector(`a[href="${webcal}"]`)).toBeInTheDocument();
    expect(document.querySelector('a[href*="outlook.office.com"]')).toHaveAttribute(
      "href",
      `https://outlook.office.com/calendar/0/addfromweb?url=${encodeURIComponent(webcal)}`,
    );
    expect(document.querySelector('a[href*="proton.me/support"]')).toHaveAttribute(
      "href",
      "https://proton.me/support/subscribe-to-external-calendar#subscribe-external-link",
    );
    expect(document.querySelector('a[href^="https://chatgpt.com/"]')).toBeInTheDocument();
  });

  it("regenerates the URL after confirming", async () => {
    const user = userEvent.setup();
    renderInstructions(enabledFeed);

    await user.click(screen.getByRole("button", { name: "Regenerate URL" }));
    expect(screen.getByRole("heading", { name: "Regenerate Calendar URL?" })).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Cancel" }));
    expect(
      screen.queryByRole("heading", { name: "Regenerate Calendar URL?" }),
    ).not.toBeInTheDocument();
    expect(rotateCalendarFeedTokenMutation).not.toHaveBeenCalled();

    await user.click(screen.getByRole("button", { name: "Regenerate URL" }));
    await user.click(screen.getByRole("button", { name: "Regenerate" }));

    await waitFor(() => {
      expect(rotateCalendarFeedTokenMutation).toHaveBeenCalledOnce();
    });
    expect(await screen.findByText(CALENDAR_FEED_ROTATED_URL)).toBeInTheDocument();
  });

  it("disables the feed after confirming", async () => {
    const user = userEvent.setup();
    renderInstructions(enabledFeed);

    await user.click(screen.getByRole("button", { name: "Disable" }));
    expect(screen.getByRole("heading", { name: "Disable Calendar Feed?" })).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Cancel" }));
    expect(
      screen.queryByRole("heading", { name: "Disable Calendar Feed?" }),
    ).not.toBeInTheDocument();
    expect(deleteCalendarFeedMutation).not.toHaveBeenCalled();

    await user.click(screen.getByRole("button", { name: "Disable" }));
    await user.click(
      within(screen.getByRole("alertdialog")).getByRole("button", { name: "Disable" }),
    );

    await waitFor(() => {
      expect(deleteCalendarFeedMutation).toHaveBeenCalledOnce();
    });
    expect(await screen.findByRole("button", { name: "Enable" })).toBeInTheDocument();
  });
});

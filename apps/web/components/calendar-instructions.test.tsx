import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { page } from "vitest/browser";

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

import { createTestQueryClient, render } from "@/mocks/react";
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

async function renderInstructions(feed: CalendarFeedData = { enabled: false }) {
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
    await renderInstructions();

    await page.getByRole("button", { name: "Enable" }).click();

    await vi.waitFor(() => {
      expect(enableCalendarFeedMutation).toHaveBeenCalledOnce();
    });
    await expect
      .element(page.getByText("Treat this URL like a password!", { exact: true }))
      .toBeInTheDocument();
    await expect.element(page.getByText(CALENDAR_FEED_URL, { exact: true })).toBeInTheDocument();
  });

  it("shows the feed URL and last-accessed copy when enabled", async () => {
    await renderInstructions({
      ...enabledFeed,
      lastAccessedAt: new Date(Date.now() - 2 * 60 * 60 * 1000),
    });

    await expect
      .element(page.getByText("Treat this URL like a password!", { exact: true }))
      .toBeInTheDocument();
    await expect.element(page.getByText(CALENDAR_FEED_URL, { exact: true })).toBeInTheDocument();
    await expect.element(page.getByText(/Last accessed/)).toBeInTheDocument();
    await expect
      .element(page.getByText("Not accessed yet.", { exact: true }))
      .not.toBeInTheDocument();
  });

  it("says the feed has not been accessed yet", async () => {
    await renderInstructions(enabledFeed);

    await expect.element(page.getByText("Not accessed yet.", { exact: true })).toBeInTheDocument();
  });

  it("treats an invalid last-accessed timestamp as not accessed", async () => {
    await renderInstructions({
      ...enabledFeed,
      lastAccessedAt: new Date(Number.NaN),
    });

    await expect.element(page.getByText("Not accessed yet.", { exact: true })).toBeInTheDocument();
    await expect.element(page.getByText(/Last accessed/)).not.toBeInTheDocument();
  });

  it("opens calendar apps from the Open In menu", async () => {
    await renderInstructions(enabledFeed);

    await page.getByRole("button", { name: /Open In/ }).click();
    await expect.element(page.getByRole("menu")).toBeInTheDocument();

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
    await renderInstructions(enabledFeed);

    await page.getByRole("button", { name: "Regenerate URL" }).click();
    await expect
      .element(page.getByRole("heading", { name: "Regenerate Calendar URL?" }))
      .toBeInTheDocument();

    await page.getByRole("alertdialog").getByRole("button", { name: "Cancel" }).click();
    await expect
      .element(page.getByRole("heading", { name: "Regenerate Calendar URL?" }))
      .not.toBeInTheDocument();
    expect(rotateCalendarFeedTokenMutation).not.toHaveBeenCalled();

    await page.getByRole("button", { name: "Regenerate URL" }).click();
    await expect.element(page.getByRole("alertdialog")).toBeInTheDocument();
    await page.getByRole("alertdialog").getByRole("button", { name: "Regenerate" }).click();

    await vi.waitFor(() => {
      expect(rotateCalendarFeedTokenMutation).toHaveBeenCalledOnce();
    });
    await expect
      .element(page.getByText(CALENDAR_FEED_ROTATED_URL, { exact: true }))
      .toBeInTheDocument();
  });

  it("disables the feed after confirming", async () => {
    await renderInstructions(enabledFeed);

    await page.getByRole("button", { name: "Disable" }).click();
    await expect
      .element(page.getByRole("heading", { name: "Disable Calendar Feed?" }))
      .toBeInTheDocument();

    await page.getByRole("alertdialog").getByRole("button", { name: "Cancel" }).click();
    await expect
      .element(page.getByRole("heading", { name: "Disable Calendar Feed?" }))
      .not.toBeInTheDocument();
    expect(deleteCalendarFeedMutation).not.toHaveBeenCalled();

    await page.getByRole("button", { name: "Disable" }).click();
    await expect.element(page.getByRole("alertdialog")).toBeInTheDocument();
    await page.getByRole("alertdialog").getByRole("button", { name: "Disable" }).click();

    await vi.waitFor(() => {
      expect(deleteCalendarFeedMutation).toHaveBeenCalledOnce();
    });
    await expect.element(page.getByRole("button", { name: "Enable" })).toBeInTheDocument();
  });
});

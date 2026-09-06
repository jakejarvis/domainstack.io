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
import { CALENDAR_FEED_QUERY_KEY, resetTrpcMocks, setCalendarFeedState } from "@/mocks/trpc";

import { CalendarFeedPopover } from "./calendar-feed-popover";

describe("CalendarFeedPopover", () => {
  beforeEach(() => {
    resetTrpcMocks();
  });

  afterEach(() => {
    resetTrpcMocks();
  });

  it("opens the calendar feed instructions", async () => {
    const queryClient = createTestQueryClient();
    setCalendarFeedState({ enabled: false });
    queryClient.setQueryData(CALENDAR_FEED_QUERY_KEY, { enabled: false });

    await render(<CalendarFeedPopover />, { queryClient });

    await page.getByRole("button", { name: "Subscribe" }).click();

    await expect.element(page.getByRole("heading", { name: "Calendar Feed" })).toBeInTheDocument();
    await expect
      .element(
        page.getByText("Subscribe to domain expiration dates in your favorite calendar app", {
          exact: true,
        }),
      )
      .toBeInTheDocument();
    await expect.element(page.getByRole("button", { name: "Enable" })).toBeInTheDocument();
  });
});

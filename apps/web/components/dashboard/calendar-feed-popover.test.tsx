import userEvent from "@testing-library/user-event";
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

import { createTestQueryClient, render, screen } from "@/mocks/react";
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
    const user = userEvent.setup();
    const queryClient = createTestQueryClient();
    setCalendarFeedState({ enabled: false });
    queryClient.setQueryData(CALENDAR_FEED_QUERY_KEY, { enabled: false });

    render(<CalendarFeedPopover />, { queryClient });

    await user.click(screen.getByRole("button", { name: "Subscribe" }));

    expect(screen.getByRole("heading", { name: "Calendar Feed" })).toBeInTheDocument();
    expect(
      screen.getByText("Subscribe to domain expiration dates in your favorite calendar app"),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Enable" })).toBeInTheDocument();
  });
});

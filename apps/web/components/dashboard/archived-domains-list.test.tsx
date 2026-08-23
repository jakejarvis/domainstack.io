import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/hooks/use-subscription", async () => {
  const { useSubscription } = await import("./mocks/subscription");
  return { useSubscription };
});
vi.mock("@/components/icons/favicon", async () => {
  const { Favicon } = await import("./mocks/leaf");
  return { Favicon };
});
vi.mock("@/components/icons/provider-logo", async () => {
  const { ProviderLogo } = await import("./mocks/leaf");
  return { ProviderLogo };
});
vi.mock("@/components/domain/screenshot-popover", async () => {
  const { ScreenshotPopover } = await import("./mocks/leaf");
  return { ScreenshotPopover };
});
vi.mock("@/components/dashboard/calendar-feed-popover", async () => {
  const { CalendarFeedPopover } = await import("./mocks/leaf");
  return { CalendarFeedPopover };
});
vi.mock("@/hooks/use-provider-tooltip-data", async () => {
  const { useProviderTooltipData } = await import("./mocks/leaf");
  return { useProviderTooltipData };
});

import { DASHBOARD_TEST_NOW, makeTrackedDomain } from "@/components/dashboard/test-fixtures";
import {
  dashboardActionSpies,
  renderArchivedList,
  resetDashboardTestState,
} from "@/components/dashboard/test-utils";
import { screen } from "@/mocks/react";

describe("ArchivedDomainsList", () => {
  beforeEach(() => {
    resetDashboardTestState();
  });

  afterEach(() => {
    resetDashboardTestState();
    vi.useRealTimers();
  });

  it("shows an empty state", () => {
    renderArchivedList([]);
    expect(screen.getByText("No archived domains")).toBeInTheDocument();
  });

  it("reactivates and deletes an archived domain", async () => {
    const user = userEvent.setup();
    const archived = makeTrackedDomain({
      id: "domain-archived",
      domainName: "archived.com",
      archivedAt: DASHBOARD_TEST_NOW,
    });
    renderArchivedList([archived]);

    expect(screen.getByText("archived.com")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /Reactivate/ }));
    expect(dashboardActionSpies.onUnarchive).toHaveBeenCalledWith("domain-archived");

    await user.click(screen.getByRole("button", { name: "Delete" }));
    expect(dashboardActionSpies.onRemove).toHaveBeenCalledWith("domain-archived", "archived.com");
  });
});

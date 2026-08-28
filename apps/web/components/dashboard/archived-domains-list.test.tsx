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
  mockSubscription,
  renderArchivedList,
  resetDashboardTestState,
} from "@/components/dashboard/test-utils";
import { screen } from "@/mocks/react";
import { PLAN_QUOTAS } from "@domainstack/constants";

const archived = makeTrackedDomain({
  id: "domain-archived",
  domainName: "archived.com",
  archivedAt: DASHBOARD_TEST_NOW,
});

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
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    renderArchivedList([archived]);

    expect(screen.getByText("archived.com")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /Reactivate/ }));
    expect(dashboardActionSpies.onUnarchive).toHaveBeenCalledWith("domain-archived");

    await user.click(screen.getByRole("button", { name: "Delete" }));
    expect(dashboardActionSpies.onRemove).toHaveBeenCalledWith("domain-archived");
  });

  it("blocks reactivate and shows an upgrade banner on Free at the limit", async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    mockSubscription.plan = "free";
    mockSubscription.planQuota = PLAN_QUOTAS.free;
    mockSubscription.canAddMore = false;
    renderArchivedList([archived]);

    expect(screen.getByText("Upgrade to Reactivate")).toBeInTheDocument();
    expect(screen.getByText(/You've reached your domain tracking limit/)).toBeInTheDocument();

    const reactivate = screen.getByRole("button", { name: /Reactivate/ });
    expect(reactivate).toBeDisabled();
    await user.click(reactivate);
    expect(dashboardActionSpies.onUnarchive).not.toHaveBeenCalled();

    await user.click(screen.getByRole("button", { name: "Delete" }));
    expect(dashboardActionSpies.onRemove).toHaveBeenCalledWith("domain-archived");
  });

  it("keeps reactivate disabled for Pro at the limit without the upgrade banner", async () => {
    mockSubscription.plan = "pro";
    mockSubscription.planQuota = PLAN_QUOTAS.pro;
    mockSubscription.canAddMore = false;
    renderArchivedList([archived]);

    expect(screen.queryByText("Upgrade to Reactivate")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Reactivate/ })).toBeDisabled();
  });
});

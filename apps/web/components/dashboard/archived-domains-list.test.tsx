import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { page } from "vitest/browser";

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

  it("shows an empty state", async () => {
    await renderArchivedList([]);
    await expect
      .element(page.getByText("No archived domains", { exact: true }))
      .toBeInTheDocument();
  });

  it("reactivates and deletes an archived domain", async () => {
    await renderArchivedList([archived]);

    await expect.element(page.getByText("archived.com", { exact: true })).toBeInTheDocument();

    await page.getByRole("button", { name: /Reactivate/ }).click();
    expect(dashboardActionSpies.onUnarchive).toHaveBeenCalledWith("domain-archived");

    await page.getByRole("button", { name: "Delete" }).click();
    expect(dashboardActionSpies.onRemove).toHaveBeenCalledWith("domain-archived");
  });

  it("blocks reactivate and shows an upgrade banner on Free at the limit", async () => {
    mockSubscription.plan = "free";
    mockSubscription.planQuota = PLAN_QUOTAS.free;
    mockSubscription.canAddMore = false;
    await renderArchivedList([archived]);

    await expect
      .element(page.getByText("Upgrade to Reactivate", { exact: true }))
      .toBeInTheDocument();
    await expect
      .element(page.getByText(/You've reached your domain tracking limit/))
      .toBeInTheDocument();

    const reactivate = page.getByRole("button", { name: /Reactivate/ });
    await expect.element(reactivate).toBeDisabled();
    expect(dashboardActionSpies.onUnarchive).not.toHaveBeenCalled();

    await page.getByRole("button", { name: "Delete" }).click();
    expect(dashboardActionSpies.onRemove).toHaveBeenCalledWith("domain-archived");
  });

  it("keeps reactivate disabled for Pro at the limit without the upgrade banner", async () => {
    mockSubscription.plan = "pro";
    mockSubscription.planQuota = PLAN_QUOTAS.pro;
    mockSubscription.canAddMore = false;
    await renderArchivedList([archived]);

    await expect
      .element(page.getByText("Upgrade to Reactivate", { exact: true }))
      .not.toBeInTheDocument();
    await expect.element(page.getByRole("button", { name: /Reactivate/ })).toBeDisabled();
  });
});

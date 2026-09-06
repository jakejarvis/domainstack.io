import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { page, userEvent } from "vitest/browser";

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

import { SubscriptionEndingBanner } from "@/components/dashboard/subscription-ending-banner";
import { daysFromTestNow } from "@/components/dashboard/test-fixtures";
import {
  mockSubscription,
  renderDashboardShell,
  resetDashboardTestState,
  subscriptionActionSpies,
} from "@/components/dashboard/test-utils";
import { UpgradeBanner } from "@/components/dashboard/upgrade-banner";
import { render } from "@/mocks/react";
import { PLAN_QUOTAS } from "@domainstack/constants";

async function waitForCatalog() {
  await expect.element(page.getByRole("link", { name: "alpha.com" })).toBeInTheDocument();
}

describe("dashboard quota and banners", () => {
  beforeEach(() => {
    resetDashboardTestState();
  });

  afterEach(() => {
    resetDashboardTestState();
    vi.useRealTimers();
  });

  describe("header", () => {
    it("shows the Pro badge, quota meter, and Add Domain link", async () => {
      await renderDashboardShell();
      await waitForCatalog();

      await expect.element(page.getByText("Pro", { exact: true })).toBeInTheDocument();
      await expect
        .element(page.getByRole("meter", { name: "Domain usage" }))
        .toHaveAttribute("aria-valuetext", "4 of 100 domains used");
      await expect.element(page.getByText("4/100", { exact: true })).toBeInTheDocument();
      await expect
        .element(page.getByRole("link", { name: "Add Domain" }))
        .toHaveAttribute("href", "/dashboard/add-domain");
    });

    it("shows a Free badge", async () => {
      mockSubscription.plan = "free";
      mockSubscription.planQuota = PLAN_QUOTAS.free;
      await renderDashboardShell();
      await waitForCatalog();

      await expect.element(page.getByText("Free", { exact: true })).toBeInTheDocument();
      await expect.element(page.getByText("Pro", { exact: true })).not.toBeInTheDocument();
    });

    it("disables Add Domain at the Pro limit", async () => {
      mockSubscription.canAddMore = false;
      await renderDashboardShell();
      await waitForCatalog();

      const addDomain = page.getByRole("button", { name: "Add Domain" });
      await expect.element(addDomain).toBeDisabled();
      await expect.element(page.getByRole("link", { name: "Add Domain" })).not.toBeInTheDocument();

      await addDomain.hover();
      await expect
        .element(page.getByText("Domain limit reached", { exact: true }))
        .toBeInTheDocument();
    });

    it("offers checkout from the at-limit tooltip on Free", async () => {
      mockSubscription.plan = "free";
      mockSubscription.planQuota = PLAN_QUOTAS.free;
      mockSubscription.canAddMore = false;
      await renderDashboardShell();
      await waitForCatalog();

      await page.getByRole("button", { name: "Add Domain" }).hover();
      const upgrade = page.getByRole("button", { name: /Upgrade to add more domains/ });
      await expect.element(upgrade).toBeInTheDocument();
      await upgrade.click();
      expect(subscriptionActionSpies.handleCheckout).toHaveBeenCalledOnce();
    });

    it("shows access-until copy on a canceling Pro badge", async () => {
      mockSubscription.endsAt = daysFromTestNow(10);
      await renderDashboardShell();
      await waitForCatalog();

      await page.getByText("Pro", { exact: true }).hover();
      await expect
        .element(page.getByText("Access until Sep 2, 2026", { exact: true }))
        .toBeInTheDocument();
    });
  });

  describe("UpgradeBanner", () => {
    it("hides for Pro and for Free users under 80%", async () => {
      await render(<UpgradeBanner />);
      await expect
        .element(page.getByText("Approaching Limit", { exact: true }))
        .not.toBeInTheDocument();
      await expect
        .element(page.getByText("Domain Limit Reached", { exact: true }))
        .not.toBeInTheDocument();

      mockSubscription.plan = "free";
      mockSubscription.planQuota = PLAN_QUOTAS.free;
      mockSubscription.activeCount = 3;
      mockSubscription.canAddMore = true;
      await render(<UpgradeBanner />);
      await expect
        .element(page.getByText("Approaching Limit", { exact: true }))
        .not.toBeInTheDocument();
    });

    it("warns when Free is near the limit and can be dismissed", async () => {
      mockSubscription.plan = "free";
      mockSubscription.planQuota = PLAN_QUOTAS.free;
      mockSubscription.activeCount = 4;
      mockSubscription.canAddMore = true;
      await render(<UpgradeBanner />);

      await expect.element(page.getByText("Approaching Limit", { exact: true })).toBeVisible();
      await expect.element(page.getByText(/You're using 4 of 5 domain slots/)).toBeInTheDocument();

      await page.getByText("Approaching Limit", { exact: true }).hover();
      await page.getByRole("button", { name: "Dismiss" }).click();
      await expect
        .element(page.getByText("Approaching Limit", { exact: true }))
        .not.toBeInTheDocument();
    });

    it("shows the at-limit banner and starts checkout", async () => {
      mockSubscription.plan = "free";
      mockSubscription.planQuota = PLAN_QUOTAS.free;
      mockSubscription.activeCount = 5;
      mockSubscription.canAddMore = false;
      await render(<UpgradeBanner />);

      await expect
        .element(page.getByText("Domain Limit Reached", { exact: true }))
        .toBeInTheDocument();
      await expect
        .element(page.getByText(/You've reached your limit of 5 tracked domains/))
        .toBeInTheDocument();

      await page.getByRole("button", { name: "Upgrade" }).click();
      expect(subscriptionActionSpies.handleCheckout).toHaveBeenCalledOnce();
    });
  });

  describe("SubscriptionEndingBanner", () => {
    it("hides without an end date or when already expired", async () => {
      await render(<SubscriptionEndingBanner />);
      await expect
        .element(page.getByText("Your Pro subscription is ending", { exact: true }))
        .not.toBeInTheDocument();

      mockSubscription.endsAt = daysFromTestNow(-1);
      await render(<SubscriptionEndingBanner />);
      await expect.element(page.getByText(/Pro subscription ending/)).not.toBeInTheDocument();
    });

    it("shows resubscribe actions when Pro is ending later", async () => {
      mockSubscription.endsAt = daysFromTestNow(10);
      await render(<SubscriptionEndingBanner />);

      await expect
        .element(page.getByText("Your Pro subscription is ending", { exact: true }))
        .toBeInTheDocument();
      await expect.element(page.getByText("Sep 2, 2026", { exact: true })).toBeInTheDocument();
      await expect
        .element(page.getByText(new RegExp(`free quota of ${PLAN_QUOTAS.free} domains`)))
        .toBeInTheDocument();

      await page.getByRole("button", { name: "Resubscribe" }).click();
      expect(subscriptionActionSpies.handleCheckout).toHaveBeenCalledOnce();

      await page.getByRole("button", { name: "Manage" }).click();
      expect(subscriptionActionSpies.handleCustomerPortal).toHaveBeenCalledOnce();
    });

    it("uses urgent copy when Pro ends within three days", async () => {
      mockSubscription.endsAt = daysFromTestNow(2);
      await render(<SubscriptionEndingBanner />);

      await expect
        .element(page.getByText("Pro subscription ending in 2 days", { exact: true }))
        .toBeInTheDocument();
    });
  });
});

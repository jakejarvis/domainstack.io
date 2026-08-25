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

import { SubscriptionEndingBanner } from "@/components/dashboard/subscription-ending-banner";
import { daysFromTestNow } from "@/components/dashboard/test-fixtures";
import {
  mockSubscription,
  renderDashboardShell,
  resetDashboardTestState,
  subscriptionActionSpies,
} from "@/components/dashboard/test-utils";
import { UpgradeBanner } from "@/components/dashboard/upgrade-banner";
import { render, screen, waitFor } from "@/mocks/react";
import { PLAN_QUOTAS } from "@domainstack/constants";

async function waitForCatalog() {
  await waitFor(() => {
    expect(screen.getByRole("link", { name: "alpha.com" })).toBeInTheDocument();
  });
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
      renderDashboardShell();
      await waitForCatalog();

      expect(screen.getByText("Pro")).toBeInTheDocument();
      expect(screen.getByRole("meter", { name: "Domain usage" })).toHaveAttribute(
        "aria-valuetext",
        "4 of 100 domains used",
      );
      expect(screen.getByText("4/100")).toBeInTheDocument();
      expect(screen.getByRole("link", { name: "Add Domain" })).toHaveAttribute(
        "href",
        "/dashboard/add-domain",
      );
    });

    it("shows a Free badge", async () => {
      mockSubscription.plan = "free";
      mockSubscription.planQuota = PLAN_QUOTAS.free;
      renderDashboardShell();
      await waitForCatalog();

      expect(screen.getByText("Free")).toBeInTheDocument();
      expect(screen.queryByText("Pro")).not.toBeInTheDocument();
    });

    it("disables Add Domain at the Pro limit", async () => {
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
      mockSubscription.canAddMore = false;
      renderDashboardShell();
      await waitForCatalog();

      const addDomain = screen.getByRole("button", { name: "Add Domain" });
      expect(addDomain).toBeDisabled();
      expect(screen.queryByRole("link", { name: "Add Domain" })).not.toBeInTheDocument();

      await user.hover(addDomain);
      expect(await screen.findByText("Domain limit reached")).toBeInTheDocument();
    });

    it("offers checkout from the at-limit tooltip on Free", async () => {
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
      mockSubscription.plan = "free";
      mockSubscription.planQuota = PLAN_QUOTAS.free;
      mockSubscription.canAddMore = false;
      renderDashboardShell();
      await waitForCatalog();

      await user.hover(screen.getByRole("button", { name: "Add Domain" }));
      const upgrade = await screen.findByRole("button", { name: /Upgrade to add more domains/ });
      await user.click(upgrade);
      expect(subscriptionActionSpies.handleCheckout).toHaveBeenCalledOnce();
    });

    it("shows access-until copy on a canceling Pro badge", async () => {
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
      mockSubscription.endsAt = daysFromTestNow(10);
      renderDashboardShell();
      await waitForCatalog();

      await user.hover(screen.getByText("Pro"));
      expect(await screen.findByText("Access until Sep 2, 2026")).toBeInTheDocument();
    });
  });

  describe("UpgradeBanner", () => {
    it("hides for Pro and for Free users under 80%", () => {
      render(<UpgradeBanner />);
      expect(screen.queryByText("Approaching Limit")).not.toBeInTheDocument();
      expect(screen.queryByText("Domain Limit Reached")).not.toBeInTheDocument();

      mockSubscription.plan = "free";
      mockSubscription.planQuota = PLAN_QUOTAS.free;
      mockSubscription.activeCount = 3;
      mockSubscription.canAddMore = true;
      render(<UpgradeBanner />);
      expect(screen.queryByText("Approaching Limit")).not.toBeInTheDocument();
    });

    it("warns when Free is near the limit and can be dismissed", async () => {
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
      mockSubscription.plan = "free";
      mockSubscription.planQuota = PLAN_QUOTAS.free;
      mockSubscription.activeCount = 4;
      mockSubscription.canAddMore = true;
      render(<UpgradeBanner />);

      expect(screen.getByText("Approaching Limit")).toBeInTheDocument();
      expect(screen.getByText(/You're using 4 of 5 domain slots/)).toBeInTheDocument();

      await user.hover(screen.getByText("Approaching Limit"));
      await user.click(screen.getByRole("button", { name: "Dismiss" }));
      await waitFor(() => {
        expect(screen.queryByText("Approaching Limit")).not.toBeInTheDocument();
      });
    });

    it("shows the at-limit banner and starts checkout", async () => {
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
      mockSubscription.plan = "free";
      mockSubscription.planQuota = PLAN_QUOTAS.free;
      mockSubscription.activeCount = 5;
      mockSubscription.canAddMore = false;
      render(<UpgradeBanner />);

      expect(screen.getByText("Domain Limit Reached")).toBeInTheDocument();
      expect(
        screen.getByText(/You've reached your limit of 5 tracked domains/),
      ).toBeInTheDocument();

      await user.click(screen.getByRole("button", { name: "Upgrade" }));
      expect(subscriptionActionSpies.handleCheckout).toHaveBeenCalledOnce();
    });
  });

  describe("SubscriptionEndingBanner", () => {
    it("hides without an end date or when already expired", () => {
      render(<SubscriptionEndingBanner />);
      expect(screen.queryByText("Your Pro subscription is ending")).not.toBeInTheDocument();

      mockSubscription.endsAt = daysFromTestNow(-1);
      render(<SubscriptionEndingBanner />);
      expect(screen.queryByText(/Pro subscription ending/)).not.toBeInTheDocument();
    });

    it("shows resubscribe actions when Pro is ending later", async () => {
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
      mockSubscription.endsAt = daysFromTestNow(10);
      render(<SubscriptionEndingBanner />);

      expect(screen.getByText("Your Pro subscription is ending")).toBeInTheDocument();
      expect(screen.getByText("September 2, 2026")).toBeInTheDocument();
      expect(
        screen.getByText(new RegExp(`free quota of ${PLAN_QUOTAS.free} domains`)),
      ).toBeInTheDocument();

      await user.click(screen.getByRole("button", { name: "Resubscribe" }));
      expect(subscriptionActionSpies.handleCheckout).toHaveBeenCalledOnce();

      await user.click(screen.getByRole("button", { name: "Manage" }));
      expect(subscriptionActionSpies.handleCustomerPortal).toHaveBeenCalledOnce();
    });

    it("uses urgent copy when Pro ends within three days", () => {
      mockSubscription.endsAt = daysFromTestNow(2);
      render(<SubscriptionEndingBanner />);

      expect(screen.getByText("Pro subscription ending in 2 days")).toBeInTheDocument();
    });
  });
});

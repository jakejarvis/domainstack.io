import { Gauge, ShoppingCart } from "lucide-react";
import { DashboardBannerDismissable } from "@/components/dashboard/dashboard-banner-dismissable";
import { UpgradeButton } from "@/components/upgrade-button";
import { useSubscription } from "@/hooks/use-subscription";

export function UpgradeBanner() {
  const { subscription, isPro, isSubscriptionLoading } = useSubscription();

  if (!subscription || isSubscriptionLoading || isPro) {
    return null;
  }

  // Show prompt when at 80% capacity or at limit
  const nearLimit = subscription.activeCount >= subscription.planQuota * 0.8;
  const atLimit = subscription.activeCount >= subscription.planQuota;

  if (!nearLimit) return null;

  return (
    <DashboardBannerDismissable
      variant={atLimit ? "danger" : "warning"}
      icon={Gauge}
      title={atLimit ? "Domain Limit Reached" : "Approaching Limit"}
      description={
        <>
          {atLimit
            ? `You've reached your limit of ${subscription.planQuota} tracked domains.`
            : `You're using ${subscription.activeCount} of ${subscription.planQuota} domain slots.`}{" "}
          Upgrade to Pro for more capacity.
        </>
      }
      dismissible
      action={
        <UpgradeButton className="w-full md:w-auto">
          <ShoppingCart className="size-4" />
          Upgrade
        </UpgradeButton>
      }
    />
  );
}

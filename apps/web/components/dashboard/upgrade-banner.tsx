import { IconGauge, IconShoppingCart } from "@tabler/icons-react";

import { DashboardBannerDismissable } from "@/components/dashboard/dashboard-banner-dismissable";
import { useSubscription } from "@/hooks/use-subscription";
import { Button } from "@domainstack/ui/button";
import { Spinner } from "@domainstack/ui/spinner";

export function UpgradeBanner() {
  const { handleCheckout, isCheckoutLoading, subscription, isPro, isSubscriptionLoading } =
    useSubscription();

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
      icon={IconGauge}
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
        <Button className="w-full md:w-auto" onClick={handleCheckout} disabled={isCheckoutLoading}>
          {isCheckoutLoading ? <Spinner /> : <IconShoppingCart />}
          Upgrade
        </Button>
      }
    />
  );
}

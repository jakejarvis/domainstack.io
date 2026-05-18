import { IconCreditCard, IconExternalLink } from "@tabler/icons-react";
import { format } from "date-fns";

import { PlanStatusCard } from "@/components/plan-status-card";
import { SettingsCard } from "@/components/settings/settings-card";
import { SubscriptionSkeleton } from "@/components/settings/settings-skeleton";
import { UpgradeCard } from "@/components/upgrade-card";
import { useSubscription } from "@/hooks/use-subscription";
import { Button } from "@domainstack/ui/button";
import { Spinner } from "@domainstack/ui/spinner";

// Native store subscription-management pages (web can't tell which store, so
// surface both — mirrors the native double-billing guard and the
// account-deletion reminder email).
const APPLE_SUBSCRIPTIONS_URL = "https://apps.apple.com/account/subscriptions";
const GOOGLE_SUBSCRIPTIONS_URL = "https://play.google.com/store/account/subscriptions";

export function SubscriptionPanel() {
  // Subscription query and hooks
  const {
    subscription,
    isPro,
    isSubscriptionLoading,
    isSubscriptionError,
    handleCustomerPortal,
    isCustomerPortalLoading,
  } = useSubscription();

  if (isSubscriptionLoading) {
    return <SubscriptionSkeleton />;
  }

  if (isSubscriptionError) {
    return <SettingsCard title="Plan" description="Failed to load subscription information" />;
  }

  return (
    <SettingsCard
      title="Plan"
      description={
        isPro
          ? "You're on the Pro plan. Thank you for your support!"
          : "Upgrade to Pro for more tracked domains."
      }
    >
      <div className="space-y-4">
        {/* Current plan info */}
        {subscription && (
          <PlanStatusCard
            activeCount={subscription.activeCount}
            planQuota={subscription.planQuota}
            isPro={isPro}
            endsAt={subscription.endsAt}
          />
        )}

        {/* Actions */}
        {isPro ? (
          <div className="space-y-2">
            {subscription?.provider && subscription.provider !== "polar" ? (
              // This user's Pro comes from a mobile in-app purchase — they have
              // no Polar subscription, so the Polar customer portal would be
              // empty. Send them to the store instead (symmetric to the native
              // app's double-billing guard).
              <>
                <p className="text-sm text-muted-foreground">
                  Your Pro subscription was purchased in the Domainstack mobile app. Manage or
                  cancel it from your device&apos;s subscription settings.
                </p>
                <div className="flex flex-col gap-2 sm:flex-row">
                  <Button
                    variant="outline"
                    className="w-full"
                    nativeButton={false}
                    render={<a href={APPLE_SUBSCRIPTIONS_URL} target="_blank" rel="noreferrer" />}
                  >
                    Manage on the App Store
                    <IconExternalLink />
                  </Button>
                  <Button
                    variant="outline"
                    className="w-full"
                    nativeButton={false}
                    render={<a href={GOOGLE_SUBSCRIPTIONS_URL} target="_blank" rel="noreferrer" />}
                  >
                    Manage on Google Play
                    <IconExternalLink />
                  </Button>
                </div>
              </>
            ) : (
              <Button
                variant="outline"
                onClick={handleCustomerPortal}
                disabled={isCustomerPortalLoading}
                className="w-full"
              >
                {isCustomerPortalLoading ? <Spinner /> : <IconCreditCard />}
                Manage Subscription
              </Button>
            )}
            {subscription?.endsAt && (
              <p className="text-center text-xs text-muted-foreground">
                Your Pro access continues until {format(subscription.endsAt, "MMMM d, yyyy")}
              </p>
            )}
          </div>
        ) : (
          <UpgradeCard />
        )}
      </div>
    </SettingsCard>
  );
}

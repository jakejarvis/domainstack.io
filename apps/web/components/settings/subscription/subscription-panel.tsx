import { Button } from "@domainstack/ui/button";
import { Spinner } from "@domainstack/ui/spinner";
import { IconCreditCard } from "@tabler/icons-react";
import { format } from "date-fns";
import { PlanStatusCard } from "@/components/plan-status-card";
import { SettingsCard } from "@/components/settings/settings-card";
import { SubscriptionSkeleton } from "@/components/settings/settings-skeleton";
import { UpgradeCard } from "@/components/upgrade-card";
import { useSubscription } from "@/hooks/use-subscription";

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
    return (
      <SettingsCard
        title="Plan"
        description="Failed to load subscription information"
      />
    );
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
            <Button
              variant="outline"
              onClick={handleCustomerPortal}
              disabled={isCustomerPortalLoading}
              className="w-full"
            >
              {isCustomerPortalLoading ? <Spinner /> : <IconCreditCard />}
              Manage Subscription
            </Button>
            {subscription?.endsAt && (
              <p className="text-center text-muted-foreground text-xs">
                Your Pro access continues until{" "}
                {format(subscription.endsAt, "MMMM d, yyyy")}
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

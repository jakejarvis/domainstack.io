import { IconAlertCircle, IconCreditCard } from "@tabler/icons-react";

import { FreePlanCard, PlanFeatures, ProPlanCard } from "@/components/plan-cards";
import { PlanUsage } from "@/components/plan-usage";
import { SettingsCard } from "@/components/settings/settings-card";
import { SubscriptionSkeleton } from "@/components/settings/settings-skeleton";
import { useSubscription } from "@/hooks/use-subscription";
import { PLAN_QUOTAS } from "@domainstack/constants";
import { Alert, AlertDescription, AlertTitle } from "@domainstack/ui/alert";
import { Button } from "@domainstack/ui/button";
import { Item, ItemActions, ItemContent, ItemDescription, ItemTitle } from "@domainstack/ui/item";
import { Spinner } from "@domainstack/ui/spinner";
import { formatDate, toDateTimeAttr } from "@domainstack/utils/date";

export function SubscriptionPanel() {
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

  const portalIcon = isCustomerPortalLoading ? <Spinner /> : <IconCreditCard />;

  return (
    <SettingsCard
      title="Plan"
      description={
        isPro
          ? "You're on Pro. Thank you for supporting Domainstack!"
          : `You're on the Free plan, with up to ${PLAN_QUOTAS.free} tracked domains.`
      }
    >
      <div className="space-y-6">
        {subscription ? (
          <PlanUsage
            activeCount={subscription.activeCount}
            planQuota={subscription.planQuota}
            archivedCount={subscription.archivedCount}
          />
        ) : null}

        {isPro ? (
          <div className="space-y-3">
            {subscription?.endsAt ? (
              <Alert variant="warning">
                <IconAlertCircle aria-hidden="true" />
                <AlertTitle>
                  Pro ends{" "}
                  <time dateTime={toDateTimeAttr(subscription.endsAt)} suppressHydrationWarning>
                    {formatDate(subscription.endsAt)}
                  </time>
                </AlertTitle>
                <AlertDescription>
                  <p>
                    After that you can track up to {PLAN_QUOTAS.free} domains, and any beyond that
                    are archived.
                  </p>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleCustomerPortal}
                    disabled={isCustomerPortalLoading}
                    className="mt-2"
                  >
                    {portalIcon}
                    Resubscribe
                  </Button>
                </AlertDescription>
              </Alert>
            ) : null}

            <ProPlanCard current />

            {subscription?.endsAt ? null : (
              <Item variant="outline">
                <ItemContent>
                  <ItemTitle>Billing</ItemTitle>
                  <ItemDescription>
                    Update your payment method, download invoices, or cancel.
                  </ItemDescription>
                </ItemContent>
                <ItemActions>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleCustomerPortal}
                    disabled={isCustomerPortalLoading}
                  >
                    {portalIcon}
                    Manage billing
                  </Button>
                </ItemActions>
              </Item>
            )}
          </div>
        ) : (
          <>
            <div className="grid gap-3 sm:grid-cols-2">
              <FreePlanCard current />
              <ProPlanCard />
            </div>
            <PlanFeatures />
          </>
        )}
      </div>
    </SettingsCard>
  );
}

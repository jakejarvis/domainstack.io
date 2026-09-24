import { IconAlertCircle, IconCreditCard } from "@tabler/icons-react";

import { ProUpsell } from "@/components/plan-cards";
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
        isPro ? "You're on Pro. Thank you for supporting Domainstack!" : "You're on the Free plan."
      }
    >
      <div className="space-y-6">
        {subscription ? (
          <div className="space-y-2">
            <PlanUsage
              activeCount={subscription.activeCount}
              planQuota={subscription.planQuota}
              archivedCount={subscription.archivedCount}
            />
            {subscription.canAddMore ? null : (
              <p
                role="status"
                className="flex items-center gap-1.5 text-[13px] text-warning-foreground"
              >
                <IconAlertCircle className="size-3.5 shrink-0" aria-hidden="true" />
                Limit reached. Archive a domain to track another.
              </p>
            )}
          </div>
        ) : null}

        {isPro && subscription?.endsAt ? (
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
                After that, your {PLAN_QUOTAS.free} most recently added domains stay active and
                older ones are archived.
              </p>
              <Button
                variant="outline"
                size="sm"
                onClick={handleCustomerPortal}
                disabled={isCustomerPortalLoading}
                className="mt-2"
              >
                {portalIcon}
                Manage billing
              </Button>
            </AlertDescription>
          </Alert>
        ) : isPro ? (
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
        ) : (
          <ProUpsell />
        )}
      </div>
    </SettingsCard>
  );
}

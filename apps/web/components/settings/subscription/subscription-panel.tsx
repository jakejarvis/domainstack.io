import { IconAlertCircle, IconCreditCard } from "@tabler/icons-react";
import { useMemo } from "react";

import { FreePlanCard, PlanFeatures, ProPlanCard } from "@/components/plan-cards";
import { PlanUsage } from "@/components/plan-usage";
import { SettingsCard } from "@/components/settings/settings-card";
import { SubscriptionSkeleton } from "@/components/settings/settings-skeleton";
import { useSubscription, useSyncBilling } from "@/hooks/use-subscription";
import { PLAN_QUOTAS } from "@domainstack/constants";
import type { BillingDetails } from "@domainstack/types";
import { Alert, AlertDescription, AlertTitle } from "@domainstack/ui/alert";
import { Button } from "@domainstack/ui/button";
import { Item, ItemActions, ItemContent, ItemDescription, ItemTitle } from "@domainstack/ui/item";
import { Skeleton } from "@domainstack/ui/skeleton";
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
  // runs on every panel visit, including the return from the billing portal
  const billingSync = useSyncBilling();

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

        {subscription && !subscription.canAddMore ? (
          <Alert variant="warning">
            <IconAlertCircle aria-hidden="true" />
            <AlertTitle>You&apos;ve reached your domain limit</AlertTitle>
            <AlertDescription>
              {isPro
                ? "Archive or remove a domain to track another."
                : "Archive or remove a domain to track another, or upgrade to Pro for more."}
            </AlertDescription>
          </Alert>
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
            ) : null}

            <ProPlanCard current />

            {subscription?.endsAt ? null : (
              <Item variant="outline">
                <ItemContent>
                  <ItemTitle>Billing</ItemTitle>
                  <ItemDescription>
                    <BillingSummary
                      billing={billingSync.data?.billing ?? null}
                      isPending={billingSync.isPending}
                      isError={billingSync.isError}
                      onRetry={() => void billingSync.refetch()}
                    />
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

// the local subscription only knows the plan; the interval, price, and renewal date live in Polar
function BillingSummary({
  billing,
  isPending,
  isError,
  onRetry,
}: {
  billing: BillingDetails | null;
  isPending: boolean;
  isError: boolean;
  onRetry: () => void;
}) {
  const currency = billing?.currency.toUpperCase();
  const priceFormat = useMemo(
    () =>
      currency
        ? new Intl.NumberFormat("en-US", { style: "currency", currency, minimumFractionDigits: 0 })
        : null,
    [currency],
  );

  if (isPending) {
    return <Skeleton render={<span />} className="inline-block h-3.5 w-44 align-middle" />;
  }

  if (isError) {
    return (
      <>
        Couldn&apos;t load billing details.{" "}
        <Button variant="link" size="xs" className="h-auto p-0" onClick={onRetry}>
          Retry
        </Button>
      </>
    );
  }

  if (!billing || !priceFormat) {
    return "Update your payment method, download invoices, or cancel.";
  }

  const periodEnd = billing.currentPeriodEnd;
  const price = priceFormat.format(billing.amount / 100);

  return (
    <>
      <span className="tabular-nums">
        {price}/{billing.interval}
      </span>
      {periodEnd ? (
        <>
          {" "}
          · {billing.cancelAtPeriodEnd ? "Ends" : "Renews"}{" "}
          <time dateTime={toDateTimeAttr(periodEnd)} suppressHydrationWarning>
            {formatDate(periodEnd)}
          </time>
        </>
      ) : null}
    </>
  );
}

import { CalendarDotsIcon } from "@phosphor-icons/react/ssr";
import { differenceInDays, format, formatDistanceToNow } from "date-fns";
import { DashboardBannerDismissable } from "@/components/dashboard/dashboard-banner-dismissable";
import { useHydratedNow } from "@/hooks/use-hydrated-now";
import { useSubscription } from "@/hooks/use-subscription";
import { PLAN_QUOTAS } from "@/lib/constants/plan-quotas";

export function SubscriptionEndingBanner() {
  const {
    handleCheckout,
    isCheckoutLoading,
    handleCustomerPortal,
    isCustomerPortalLoading,
  } = useSubscription();
  const now = useHydratedNow();
  const { subscription, isPro, isSubscriptionLoading } = useSubscription();

  // Don't show if subscription unavailable, or no end date
  if (
    isSubscriptionLoading ||
    !isPro ||
    !subscription ||
    !subscription.endsAt
  ) {
    return null;
  }

  // During SSR, don't show the banner (will render after hydration)
  if (!now) return null;

  // Don't show if already expired (they would have been downgraded)
  const isExpired = subscription.endsAt < now;
  if (isExpired) return null;

  const daysRemaining = differenceInDays(subscription.endsAt, now);
  const formattedDate = format(subscription.endsAt, "MMMM d, yyyy");
  const relativeTime = formatDistanceToNow(subscription.endsAt, {
    addSuffix: true,
  });

  // Determine urgency based on days remaining
  const isUrgent = daysRemaining <= 3;

  return (
    <DashboardBannerDismissable
      variant={isUrgent ? "warning" : "info"}
      icon={CalendarDotsIcon}
      title={
        isUrgent
          ? `Pro subscription ending ${relativeTime}`
          : "Your Pro subscription is ending"
      }
      description={
        <>
          Your access continues until{" "}
          <span className="font-medium">{formattedDate}</span>. After that,
          domains beyond the free quota of {PLAN_QUOTAS.free} domains will be
          archived.
        </>
      }
      action={{
        label: "Resubscribe",
        onClick: handleCheckout,
        loading: isCheckoutLoading,
      }}
      secondaryAction={{
        label: "Manage",
        onClick: handleCustomerPortal,
        loading: isCustomerPortalLoading,
      }}
    />
  );
}

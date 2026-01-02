import { differenceInDays, format, formatDistanceToNow } from "date-fns";
import { CalendarClock } from "lucide-react";
import { useEffect, useState } from "react";
import { DashboardBannerDismissable } from "@/components/dashboard/dashboard-banner-dismissable";
import { useCustomerPortal } from "@/hooks/use-customer-portal";
import type { SubscriptionData } from "@/hooks/use-subscription";
import { useUpgradeCheckout } from "@/hooks/use-upgrade-checkout";

type SubscriptionEndingBannerProps = {
  subscription: SubscriptionData;
};

export function SubscriptionEndingBanner({
  subscription,
}: SubscriptionEndingBannerProps) {
  const { handleUpgrade: handleResubscribe, isLoading } = useUpgradeCheckout();
  const { openPortal: handleManage, isLoading: isManageLoading } =
    useCustomerPortal();

  // Capture current time only on client after mount (not during SSR)
  const [now, setNow] = useState<Date | null>(null);
  useEffect(() => {
    setNow(new Date());
  }, []);

  // Don't show if subscription unavailable, or no end date
  if (!subscription || !subscription.subscriptionEndsAt) {
    return null;
  }

  // During SSR, don't show the banner (will render after hydration)
  if (!now) return null;

  const { subscriptionEndsAt } = subscription;

  // Don't show if already expired (they would have been downgraded)
  const isExpired = subscriptionEndsAt < now;
  if (isExpired) return null;

  const daysRemaining = differenceInDays(subscriptionEndsAt, now);
  const formattedDate = format(subscriptionEndsAt, "MMMM d, yyyy");
  const relativeTime = formatDistanceToNow(subscriptionEndsAt, {
    addSuffix: true,
  });

  // Determine urgency based on days remaining
  const isUrgent = daysRemaining <= 3;

  return (
    <DashboardBannerDismissable
      variant={isUrgent ? "warning" : "info"}
      icon={CalendarClock}
      title={
        isUrgent
          ? `Pro subscription ending ${relativeTime}`
          : "Your Pro subscription is ending"
      }
      description={
        <>
          Your access continues until{" "}
          <span className="font-medium">{formattedDate}</span>. After that,
          domains beyond the free tier limit will be archived.
        </>
      }
      action={{
        label: "Resubscribe",
        onClick: handleResubscribe,
        loading: isLoading,
      }}
      secondaryAction={{
        label: "Manage",
        onClick: handleManage,
        loading: isManageLoading,
      }}
    />
  );
}

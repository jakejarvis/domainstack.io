"use client";

import {
  differenceInDays,
  format,
  formatDistanceToNow,
  isPast,
} from "date-fns";
import { CalendarClock } from "lucide-react";
import { DashboardBanner } from "@/components/dashboard/dashboard-banner";
import { useCustomerPortal } from "@/hooks/use-customer-portal";
import { useUpgradeCheckout } from "@/hooks/use-upgrade-checkout";

type SubscriptionEndingBannerProps = {
  subscriptionEndsAt: Date;
};

export function SubscriptionEndingBanner({
  subscriptionEndsAt,
}: SubscriptionEndingBannerProps) {
  const { handleUpgrade: handleResubscribe, isLoading } = useUpgradeCheckout();
  const { openPortal: handleManage, isLoading: isManageLoading } =
    useCustomerPortal();

  // Don't show if already expired (they would have been downgraded)
  if (isPast(subscriptionEndsAt)) return null;

  const daysRemaining = differenceInDays(subscriptionEndsAt, new Date());
  const formattedDate = format(subscriptionEndsAt, "MMMM d, yyyy");
  const relativeTime = formatDistanceToNow(subscriptionEndsAt, {
    addSuffix: true,
  });

  // Determine urgency based on days remaining
  const isUrgent = daysRemaining <= 3;

  return (
    <DashboardBanner
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

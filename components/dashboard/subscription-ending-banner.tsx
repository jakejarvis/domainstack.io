"use client";

import {
  differenceInDays,
  format,
  formatDistanceToNow,
  isPast,
} from "date-fns";
import { CalendarClock } from "lucide-react";
import { useState } from "react";
import { DashboardBanner } from "@/components/dashboard/dashboard-banner";
import { checkout, customerPortal } from "@/lib/auth-client";
import { logger } from "@/lib/logger/client";
import { PRO_TIER_INFO } from "@/lib/polar/products";

type SubscriptionEndingBannerProps = {
  subscriptionEndsAt: Date;
};

export function SubscriptionEndingBanner({
  subscriptionEndsAt,
}: SubscriptionEndingBannerProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [isManageLoading, setIsManageLoading] = useState(false);

  // Don't show if already expired (they would have been downgraded)
  if (isPast(subscriptionEndsAt)) return null;

  const daysRemaining = differenceInDays(subscriptionEndsAt, new Date());
  const formattedDate = format(subscriptionEndsAt, "MMMM d, yyyy");
  const relativeTime = formatDistanceToNow(subscriptionEndsAt, {
    addSuffix: true,
  });

  // Determine urgency based on days remaining
  const isUrgent = daysRemaining <= 3;

  const handleResubscribe = async () => {
    setIsLoading(true);
    try {
      await checkout({
        products: [
          PRO_TIER_INFO.monthly.productId,
          PRO_TIER_INFO.yearly.productId,
        ],
      });
    } catch (err) {
      logger.error("Failed to open checkout", err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleManage = async () => {
    setIsManageLoading(true);
    try {
      await customerPortal();
    } catch (err) {
      logger.error("Failed to open customer portal", err);
    } finally {
      setIsManageLoading(false);
    }
  };

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
        label: isManageLoading ? "Opening..." : "Manage",
        onClick: handleManage,
      }}
    />
  );
}

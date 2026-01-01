"use client";

import { useState } from "react";
import { toast } from "sonner";
import { analytics } from "@/lib/analytics/client";
import { checkoutEmbed } from "@/lib/auth-client";
import { PRO_TIER_INFO } from "@/lib/polar/products";

/**
 * Hook to handle Pro tier upgrade checkout flow.
 * Provides consistent checkout behavior across upgrade UI components.
 */
export function useUpgradeCheckout() {
  const [isLoading, setIsLoading] = useState(false);

  const handleUpgrade = async () => {
    if (isLoading) return;
    setIsLoading(true);

    analytics.track("upgrade_clicked");

    try {
      await checkoutEmbed({
        products: [
          PRO_TIER_INFO.monthly.productId,
          PRO_TIER_INFO.yearly.productId,
        ],
      });
    } catch (err) {
      analytics.trackException(
        err instanceof Error ? err : new Error(String(err)),
        { action: "upgrade_checkout" },
      );
      toast.error("Failed to open checkout. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  return { handleUpgrade, isLoading };
}

"use client";

import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { checkout } from "@/lib/auth-client";
import { logger } from "@/lib/logger/client";
import { PRO_TIER_INFO } from "@/lib/polar/products";

/**
 * Hook to handle Pro tier upgrade checkout flow.
 * Provides consistent checkout behavior across upgrade UI components.
 */
export function useUpgradeCheckout() {
  const [isLoading, setIsLoading] = useState(false);
  const isMountedRef = useRef(true);

  useEffect(() => {
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  const handleUpgrade = async () => {
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
      toast.error("Failed to open checkout. Please try again.");
    } finally {
      if (isMountedRef.current) {
        setIsLoading(false);
      }
    }
  };

  return { handleUpgrade, isLoading };
}

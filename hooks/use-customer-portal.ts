"use client";

import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { analytics } from "@/lib/analytics/client";
import { customer } from "@/lib/auth-client";

/**
 * Hook to handle opening the customer portal for subscription management.
 * Provides consistent portal behavior across components.
 */
export function useCustomerPortal() {
  const [isLoading, setIsLoading] = useState(false);
  const isMountedRef = useRef(true);

  // Track mounted state to prevent setState on unmounted component
  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  const openPortal = async () => {
    if (isLoading) return;
    setIsLoading(true);
    analytics.track("customer_portal_opened");
    try {
      await customer.portal();
    } catch (err) {
      analytics.trackException(
        err instanceof Error ? err : new Error(String(err)),
        { action: "open_customer_portal" },
      );
      toast.error("Failed to open customer portal. Please try again.");
    } finally {
      if (isMountedRef.current) {
        setIsLoading(false);
      }
    }
  };

  return { openPortal, isLoading };
}

"use client";

import { useState } from "react";
import { toast } from "sonner";
import { customerPortal } from "@/lib/auth-client";
import { logger } from "@/lib/logger/client";

/**
 * Hook to handle opening the customer portal for subscription management.
 * Provides consistent portal behavior across components.
 */
export function useCustomerPortal() {
  const [isLoading, setIsLoading] = useState(false);

  const openPortal = async () => {
    if (isLoading) return;
    setIsLoading(true);
    try {
      await customerPortal();
    } catch (err) {
      logger.error("Failed to open customer portal", err);
      toast.error("Failed to open customer portal. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  return { openPortal, isLoading };
}

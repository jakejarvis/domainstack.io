"use client";

import { useSearchParams } from "next/navigation";
import { useEffect, useRef } from "react";
import { toast } from "sonner";
import { useRouter } from "@/hooks/use-router";
import { analytics } from "@/lib/analytics/client";
import { getAuthErrorMessage, isAccountLinkingError } from "@/lib/constants";

/**
 * Hook to handle auth callback error query parameters.
 *
 * Automatically:
 * - Shows toast notifications for errors with user-friendly messages
 * - Cleans up the error query param from the URL
 *
 * @example
 * // In login page (sign-in callbacks)
 * useAuthCallback();
 *
 * @example
 * // In settings (account linking callbacks)
 * useAuthCallback();
 */
export function useAuthCallback() {
  const router = useRouter();
  const searchParams = useSearchParams();
  // Track if we've already processed params to prevent double-firing
  const processedRef = useRef(false);

  useEffect(() => {
    const error = searchParams.get("error");

    // Skip if no error param or already processed
    if (!error || processedRef.current) {
      return;
    }

    // Mark as processed to prevent re-running
    processedRef.current = true;

    // Show error toast with user-friendly message
    const errorMessage = getAuthErrorMessage(error);
    const isLinkError = isAccountLinkingError(error);

    // Track auth errors in PostHog
    analytics.trackException(new Error(error), {
      action: isLinkError ? "link_account" : "sign_in",
      errorCode: error,
    });

    // Title based on error type
    const title = isLinkError ? "Failed to link account" : "Sign in failed";

    toast.error(title, {
      description: errorMessage,
    });

    // Clear error param from URL while preserving others
    const params = new URLSearchParams(searchParams.toString());
    params.delete("error");
    const newSearch = params.toString();
    const newUrl =
      window.location.pathname + (newSearch ? `?${newSearch}` : "");
    router.replace(newUrl, { scroll: false });
  }, [router, searchParams]);
}

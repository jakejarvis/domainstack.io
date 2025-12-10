"use client";

import { useSearchParams } from "next/navigation";
import { useEffect, useRef } from "react";
import { toast } from "sonner";
import { useRouter } from "@/hooks/use-router";
import { getAuthErrorMessage, isAccountLinkingError } from "@/lib/constants";
import { logger } from "@/lib/logger/client";

interface UseAuthCallbackOptions {
  /**
   * Custom success message to show when a success param is detected.
   * If not provided, no success toast is shown.
   */
  successMessage?: string;

  /**
   * The query param name that indicates success.
   * @default "linked" for account linking, but can be customized
   */
  successParam?: string;

  /**
   * Context for the auth callback (used for better error messages).
   * @default "auth"
   */
  context?: "auth" | "link";
}

/**
 * Hook to handle auth callback query parameters (error/success).
 *
 * Automatically:
 * - Shows toast notifications for errors with user-friendly messages
 * - Shows success toast when successParam is present (if configured)
 * - Cleans up auth-related query params from the URL
 *
 * @example
 * // In dashboard (sign-in callbacks)
 * useAuthCallback({ context: "auth" });
 *
 * @example
 * // In settings (account linking callbacks)
 * useAuthCallback({
 *   context: "link",
 *   successParam: "linked",
 *   successMessage: "Account linked successfully",
 * });
 */
export function useAuthCallback(options: UseAuthCallbackOptions = {}) {
  const { successMessage, successParam = "linked", context = "auth" } = options;

  const router = useRouter();
  const searchParams = useSearchParams();
  // Track if we've already processed params to prevent double-firing
  const processedRef = useRef(false);

  useEffect(() => {
    const error = searchParams.get("error");
    const success = searchParams.get(successParam);

    // Skip if no auth params to process or already processed
    if ((!error && !success) || processedRef.current) {
      return;
    }

    // Mark as processed to prevent re-running
    processedRef.current = true;

    if (error) {
      // Show error toast with user-friendly message
      const errorMessage = getAuthErrorMessage(error);
      const isLinkError = isAccountLinkingError(error);

      // Choose title based on error type and context
      let title: string;
      if (isLinkError) {
        title = "Failed to link account";
      } else if (context === "link") {
        title = "Failed to link account";
      } else {
        title = "Sign in failed";
      }

      toast.error(title, {
        description: errorMessage,
      });

      logger.warn("Auth callback error", { error, context, isLinkError });
    }

    if (success === "true" && successMessage) {
      toast.success(successMessage);
    }

    // Clear auth-related params from URL while preserving others
    const params = new URLSearchParams(searchParams.toString());
    params.delete("error");
    params.delete(successParam);
    const newSearch = params.toString();
    const newUrl =
      window.location.pathname + (newSearch ? `?${newSearch}` : "");
    router.replace(newUrl, { scroll: false });
  }, [router, searchParams, successParam, successMessage, context]);
}

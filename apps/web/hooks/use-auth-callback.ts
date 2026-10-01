"use client";

import { useSearchParams } from "next/navigation";
import posthogClient from "posthog-js";
import { useEffect, useRef } from "react";
import { toast } from "sonner";

import {
  getAuthErrorMessage,
  isAccountLinkingError,
  isKnownAuthErrorCode,
} from "@domainstack/auth/errors";

/**
 * Hook to handle auth callback error query parameters.
 *
 * Automatically:
 * - Shows toast notifications for errors with user-friendly messages
 * - Cleans up the `error` and `error_description` query params from the URL
 *
 * The URL is cleaned with `history.replaceState` rather than a router navigation:
 * `/login` and `/settings/*` have intercepting routes, so a client-side navigation
 * would open a second modal on top of the full page.
 *
 * @example
 * // In login page (sign-in callbacks)
 * useAuthCallback();
 *
 * @example
 * // In settings (account linking callbacks)
 * useAuthCallback({ context: "link" });
 */
export function useAuthCallback({ context = "sign_in" }: { context?: "sign_in" | "link" } = {}) {
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

    const isLinkError = context === "link" || isAccountLinkingError(error);

    // Track auth errors in PostHog. Only known codes are sent; anything else is
    // untrusted URL input and is reported as "unknown".
    const code = isKnownAuthErrorCode(error) ? error : "unknown";
    posthogClient.captureException(new Error(`auth callback error: ${code}`), {
      action: context === "link" ? "link_account" : "sign_in",
      errorCode: code,
    });

    toast.error(isLinkError ? "Failed to link account" : "Sign in failed", {
      description: getAuthErrorMessage(error),
    });

    // Clear error params from the URL while preserving others
    const params = new URLSearchParams(searchParams.toString());
    params.delete("error");
    params.delete("error_description");
    const newSearch = params.toString();
    const newUrl = window.location.pathname + (newSearch ? `?${newSearch}` : "");
    window.history.replaceState(window.history.state, "", newUrl);
  }, [context, searchParams]);
}

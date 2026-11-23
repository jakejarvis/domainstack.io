"use client";

import { useSearchParams } from "next/navigation";
import posthogClient from "posthog-js";
import { useEffect, useRef } from "react";
import { toast } from "sonner";

/** Query flag the change-email form puts in its callbackURL. */
export const EMAIL_CHANGE_PARAM = "email_change";

// Better Auth's /verify-email error codes (uppercase, unlike the OAuth ones).
const EMAIL_CHANGE_ERRORS: Record<string, string> = {
  TOKEN_EXPIRED: "That confirmation link has expired. Request a new one below.",
  INVALID_TOKEN: "That confirmation link isn't valid. Request a new one below.",
  USER_NOT_FOUND:
    "That confirmation link was already used, or your email changed since it was sent.",
  INVALID_USER:
    "That link is for a different Domainstack account. Sign in to that account, then open it again.",
};

/**
 * After a change-email link redirects back to Settings → Account
 * (`?email_change=1`, plus `&error=CODE` on failure), toast the result once and
 * strip those params. Uses replaceState for the same reason as useAuthCallback.
 */
export function useEmailChangeCallback() {
  const searchParams = useSearchParams();
  const processedRef = useRef(false);

  useEffect(() => {
    if (searchParams.get(EMAIL_CHANGE_PARAM) !== "1" || processedRef.current) return;
    processedRef.current = true;

    const error = searchParams.get("error");
    if (error) {
      const code = Object.hasOwn(EMAIL_CHANGE_ERRORS, error) ? error : "unknown";
      posthogClient.captureException(new Error(`email change callback error: ${code}`), {
        action: "change_email",
        errorCode: code,
      });
      toast.error("Couldn't change your email", {
        description: EMAIL_CHANGE_ERRORS[code] ?? "Something went wrong. Request a new link below.",
      });
    } else {
      toast.success("Email address updated", {
        description: "Alerts and account emails now go to your new address.",
      });
    }

    const params = new URLSearchParams(searchParams.toString());
    params.delete(EMAIL_CHANGE_PARAM);
    params.delete("error");
    params.delete("error_description");
    const newSearch = params.toString();
    window.history.replaceState(
      window.history.state,
      "",
      window.location.pathname + (newSearch ? `?${newSearch}` : ""),
    );
  }, [searchParams]);
}

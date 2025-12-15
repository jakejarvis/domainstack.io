"use client";

import Link from "next/link";
import posthog from "posthog-js";
import { useEffect, useState } from "react";
import useLocalStorageState from "use-local-storage-state";
import { Button } from "@/components/ui/button";

const CONSENT_KEY = "cookie-consent";

type ConsentStatus = "pending" | "accepted" | "declined";

/**
 * Minimal cookie consent banner for GDPR compliance.
 *
 * - Only shows for EU/EEA users (based on geolocation header from request)
 * - Non-EU users are auto-accepted silently
 * - Syncs with PostHog opt-in/opt-out
 */
export function CookiePrompt({
  consentRequired,
}: {
  consentRequired: boolean;
}) {
  const [consent, setConsent, { isPersistent }] =
    useLocalStorageState<ConsentStatus>(CONSENT_KEY, {
      defaultValue: "pending",
    });
  const [show, setShow] = useState(false);

  useEffect(() => {
    // Wait for localStorage to be available
    if (!isPersistent) return;

    if (consent !== "pending") {
      // User has already made a choice - re-apply PostHog state
      // in case it was reset (cleared cookies, new session, etc.)
      if (consent === "accepted") {
        posthog.opt_in_capturing();
      } else {
        posthog.opt_out_capturing();
      }
      setShow(false);
    } else if (!consentRequired) {
      // Non-EU user with no stored consent - auto-accept silently
      setConsent("accepted");
      posthog.opt_in_capturing();
      setShow(false);
    } else {
      // EU user needs to make a choice - show banner
      setShow(true);
    }
  }, [consent, consentRequired, isPersistent, setConsent]);

  const accept = () => {
    setConsent("accepted");
    posthog.opt_in_capturing();
    setShow(false);
  };

  const decline = () => {
    setConsent("declined");
    posthog.opt_out_capturing();
    setShow(false);
  };

  if (!show || consent !== "pending") {
    return null;
  }

  return (
    <div className="fade-in slide-in-from-bottom-2 fixed bottom-3 left-3 z-50 max-w-[260px] animate-in duration-200">
      <div
        role="dialog"
        aria-label="Cookie consent"
        className="rounded-lg border border-border/50 bg-card/95 p-3 shadow-md backdrop-blur-sm"
      >
        <p className="text-muted-foreground text-xs leading-relaxed">
          We use cookies to understand how you use our service.{" "}
          <Link
            href="/privacy#cookies"
            prefetch={false}
            className="text-foreground/80 underline underline-offset-2 hover:text-foreground"
          >
            Learn more.
          </Link>
        </p>
        <div className="mt-2 flex items-center gap-1.5">
          <Button
            variant="ghost"
            size="sm"
            onClick={decline}
            className="h-7 cursor-pointer px-2.5 text-muted-foreground text-xs"
          >
            Decline
          </Button>
          <Button
            size="sm"
            onClick={accept}
            className="h-7 cursor-pointer bg-foreground px-2.5 text-background text-xs hover:bg-foreground/90"
          >
            Accept
          </Button>
        </div>
      </div>
    </div>
  );
}

"use client";

import { Button } from "@domainstack/ui/button";
import Link from "next/link";
import posthog from "posthog-js";
import { useEffect, useState } from "react";
import useLocalStorageState from "use-local-storage-state";

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
  const [isExiting, setIsExiting] = useState(false);

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

  const handleHide = (consentStatus: ConsentStatus) => {
    setIsExiting(true);
    // Wait for exit animation to complete before actually hiding
    setTimeout(() => {
      setConsent(consentStatus);
      setShow(false);
      setIsExiting(false);
    }, 200); // Match animation duration
  };

  const accept = () => {
    posthog.opt_in_capturing();
    handleHide("accepted");
  };

  const decline = () => {
    posthog.opt_out_capturing();
    handleHide("declined");
  };

  if (!show || consent !== "pending") {
    return null;
  }

  return (
    <div
      className={`fixed bottom-3 left-3 z-100 max-w-[260px] duration-200 ${
        isExiting
          ? "slide-out-to-bottom-8 animate-out"
          : "slide-in-from-bottom-8 animate-in"
      }`}
    >
      <div
        role="dialog"
        aria-label="Cookie consent"
        className="rounded-lg border bg-card p-3 shadow-md"
      >
        <p className="text-pretty text-muted-foreground text-xs leading-relaxed">
          We use cookies to understand how you use our service.{" "}
          <Link
            href="/privacy#cookies"
            prefetch={false}
            className="text-foreground/80 underline underline-offset-2 hover:text-foreground"
          >
            Learn more.
          </Link>
        </p>
        <div className="mt-2.5 flex items-center gap-1.5">
          <Button
            variant="ghost"
            size="sm"
            onClick={decline}
            className="h-7 px-2.5 text-muted-foreground text-xs"
          >
            Decline
          </Button>
          <Button
            size="sm"
            onClick={accept}
            className="h-7 bg-foreground px-2.5 text-background text-xs hover:bg-foreground/90"
          >
            Accept
          </Button>
        </div>
      </div>
    </div>
  );
}

"use client";

import Link from "next/link";
import posthogClient from "posthog-js";
import { useEffect, useState } from "react";

import {
  type ConsentStatus,
  useConsentPersistent,
  useConsentStore,
} from "@/lib/stores/consent-store";
import { Button } from "@domainstack/ui/button";

/**
 * Minimal cookie consent banner for GDPR compliance.
 *
 * - Only shows for EU/EEA users (based on geolocation header from request)
 * - Non-EU users are auto-accepted silently
 * - Syncs with PostHog opt-in/opt-out
 */
export function CookiePrompt({ consentRequired }: { consentRequired: boolean }) {
  const consent = useConsentStore((s) => s.consent);
  const setConsent = useConsentStore((s) => s.setConsent);
  const isPersistent = useConsentPersistent();
  const [isExiting, setIsExiting] = useState(false);

  useEffect(() => {
    if (isPersistent && consent === "pending" && !consentRequired) {
      setConsent("accepted");
    }
  }, [isPersistent, consent, consentRequired, setConsent]);

  useEffect(() => {
    if (!isPersistent) return;

    if (consent === "accepted") {
      posthogClient.opt_in_capturing();
    } else if (consent === "declined") {
      posthogClient.opt_out_capturing();
    }
  }, [consent, isPersistent]);

  const handleHide = (consentStatus: ConsentStatus) => {
    setIsExiting(true);
    // Wait for exit animation to complete before actually hiding
    setTimeout(() => {
      setConsent(consentStatus);
      setIsExiting(false);
    }, 200); // Match animation duration
  };

  const accept = () => {
    posthogClient.opt_in_capturing();
    handleHide("accepted");
  };

  const decline = () => {
    posthogClient.opt_out_capturing();
    handleHide("declined");
  };

  const show = isPersistent && consent === "pending" && consentRequired;

  if (!show) {
    return null;
  }

  return (
    <div
      className={`fixed bottom-3 left-3 z-100 max-w-[260px] duration-200 ${
        isExiting ? "animate-out slide-out-to-bottom-8" : "animate-in slide-in-from-bottom-8"
      }`}
    >
      <div
        role="dialog"
        aria-label="Cookie consent"
        className="rounded-lg border bg-card p-3 shadow-md"
      >
        <p className="text-xs leading-relaxed text-pretty text-muted-foreground">
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
            className="h-7 px-2.5 text-xs text-muted-foreground"
          >
            Decline
          </Button>
          <Button
            size="sm"
            onClick={accept}
            className="h-7 bg-foreground px-2.5 text-xs text-background hover:bg-foreground/90"
          >
            Accept
          </Button>
        </div>
      </div>
    </div>
  );
}

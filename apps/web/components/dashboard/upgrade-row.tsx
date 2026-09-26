"use client";

import { IconCircleArrowUp } from "@tabler/icons-react";

import { PRO_PRICE_SUMMARY } from "@/components/plan-cards";
import { useSubscription } from "@/hooks/use-subscription";
import { PLAN_QUOTAS } from "@domainstack/constants";
import { Spinner } from "@domainstack/ui/spinner";

export function UpgradeRow() {
  const { isPro, isSubscriptionLoading, handleCheckout, isCheckoutLoading } = useSubscription();

  if (isSubscriptionLoading || isPro) {
    return null;
  }

  return (
    <button
      type="button"
      onClick={handleCheckout}
      disabled={isCheckoutLoading}
      aria-label="Upgrade to Pro"
      aria-busy={isCheckoutLoading}
      className="flex w-full cursor-pointer touch-manipulation items-center gap-4 border-t border-accent-gold/25 bg-linear-to-r from-accent-gold/10 to-transparent to-50% p-4 text-left transition-colors hover:border-accent-gold/50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring disabled:cursor-not-allowed disabled:opacity-50"
    >
      <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-accent-gold/10 ring-1 ring-accent-gold/20 ring-inset">
        {isCheckoutLoading ? (
          <Spinner className="size-5 text-accent-gold" />
        ) : (
          <IconCircleArrowUp className="size-5 text-accent-gold" aria-hidden="true" />
        )}
      </span>
      <span className="min-w-0">
        <span className="block leading-snug font-semibold">Upgrade to Pro</span>
        <span className="block text-[13px] text-muted-foreground">
          Track <span className="hidden sm:inline">up to </span>
          {PLAN_QUOTAS.pro} domains
          <span className="mx-1">•</span>
          {PRO_PRICE_SUMMARY}
        </span>
      </span>
    </button>
  );
}

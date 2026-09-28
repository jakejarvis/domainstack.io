"use client";

import { useSubscription } from "@/hooks/use-subscription";
import { PLAN_QUOTAS } from "@domainstack/constants";
import { PRO_TIER_INFO } from "@domainstack/polar/products";
import { Spinner } from "@domainstack/ui/spinner";
import { cn } from "@domainstack/ui/utils";

const PRO_YEARLY_NOTE = `or ${PRO_TIER_INFO.yearly.label}`;

/** Pro pricing as one line, for upgrade prompts. */
export const PRO_PRICE_SUMMARY = `${PRO_TIER_INFO.monthly.label} ${PRO_YEARLY_NOTE}`;

/** Compact Pro upgrade button: quota on the left, price on the right. */
export function ProUpgradeButton({ className }: { className?: string }) {
  const { handleCheckout, isCheckoutLoading } = useSubscription();

  return (
    <button
      type="button"
      onClick={handleCheckout}
      disabled={isCheckoutLoading}
      aria-label="Upgrade to Pro"
      aria-busy={isCheckoutLoading}
      className={cn(
        "w-full cursor-pointer touch-manipulation rounded-md border border-accent-gold/25 bg-linear-to-bl from-accent-gold/5 to-transparent to-60% p-4 text-left transition-colors hover:border-accent-gold/50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring disabled:cursor-not-allowed disabled:opacity-50",
        className,
      )}
    >
      <span className="flex items-center justify-between gap-5">
        <span className="min-w-0 flex-1 space-y-1">
          <span className="relative block w-fit text-sm font-semibold">
            {PRO_TIER_INFO.name}
            {isCheckoutLoading ? (
              <Spinner className="absolute top-1/2 left-full ml-2 -translate-y-1/2" />
            ) : null}
          </span>
          <span className="block truncate text-[13px] leading-4 text-muted-foreground">
            Up to{" "}
            <span className="font-medium text-foreground tabular-nums">{PLAN_QUOTAS.pro}</span>{" "}
            tracked domains
          </span>
        </span>
        <span className="min-w-0 shrink-0">
          <span className="block space-y-1 text-right leading-none">
            <span className="block text-sm font-medium tabular-nums">
              {PRO_TIER_INFO.monthly.label}
            </span>
            <span className="block truncate text-xs text-muted-foreground">{PRO_YEARLY_NOTE}</span>
          </span>
        </span>
      </span>
    </button>
  );
}

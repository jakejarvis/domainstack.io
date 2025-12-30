"use client";

import { CircleFadingArrowUp, ShoppingCart } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { useUpgradeCheckout } from "@/hooks/use-upgrade-checkout";
import { PRO_TIER_INFO } from "@/lib/polar/products";

type UpgradeBannerProps = {
  proMaxDomains: number;
};

export function UpgradeBanner({ proMaxDomains }: UpgradeBannerProps) {
  const { handleUpgrade, isLoading } = useUpgradeCheckout();

  return (
    <div className="relative overflow-hidden border-black/10 border-t bg-gradient-to-r from-black/[0.02] via-transparent to-black/[0.03] p-4 dark:border-white/10 dark:from-white/[0.02] dark:via-transparent dark:to-white/[0.03]">
      {/* Decorative elements - subtle warm glows */}
      <div
        aria-hidden
        className="pointer-events-none absolute -top-16 -right-16 size-32 rounded-full bg-accent-gold/15 blur-3xl"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -bottom-16 -left-16 size-24 rounded-full bg-accent-gold-muted/15 blur-3xl"
      />

      <div className="relative flex flex-col items-start justify-between gap-4 md:flex-row md:items-center">
        {/* Left side - Icon and text */}
        <div className="flex items-center gap-4">
          <div className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-black/5 dark:bg-white/5">
            <CircleFadingArrowUp className="size-5 text-accent-gold" />
          </div>
          <div>
            <h3 className="font-semibold">Upgrade to Pro</h3>
            <span className="text-[13px] text-muted-foreground">
              Track up to {proMaxDomains} domains
              <span className="mx-1">•</span>
              <span className="font-medium text-accent-gold">
                {PRO_TIER_INFO.monthly.label}
              </span>{" "}
              or{" "}
              <span className="font-medium text-accent-gold">
                {PRO_TIER_INFO.yearly.label}
              </span>
            </span>
          </div>
        </div>

        {/* Right side - CTA */}
        <Button
          size="lg"
          onClick={handleUpgrade}
          disabled={isLoading}
          className="w-full shrink-0 cursor-pointer md:w-auto"
        >
          {isLoading ? (
            <>
              <Spinner />
              Loading...
            </>
          ) : (
            <>
              <ShoppingCart />
              Get Pro
            </>
          )}
        </Button>
      </div>
    </div>
  );
}

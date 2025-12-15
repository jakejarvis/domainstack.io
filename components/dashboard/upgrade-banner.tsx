"use client";

import { CircleFadingArrowUp, Gem } from "lucide-react";
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
    <div className="relative overflow-hidden rounded-b-xl border border-black/10 bg-gradient-to-r from-black/[0.02] via-transparent to-black/[0.03] p-4 dark:border-white/10 dark:from-white/[0.02] dark:via-transparent dark:to-white/[0.03]">
      {/* Decorative elements - subtle warm glows */}
      <div
        aria-hidden
        className="-right-16 -top-16 pointer-events-none absolute size-32 rounded-full bg-accent-gold/15 blur-3xl"
      />
      <div
        aria-hidden
        className="-bottom-16 -left-16 pointer-events-none absolute size-24 rounded-full bg-accent-gold-muted/15 blur-3xl"
      />

      <div className="relative flex items-center justify-between gap-4">
        {/* Left side - Icon and text */}
        <div className="flex items-center gap-4">
          <div className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-black/5 dark:bg-white/5">
            <CircleFadingArrowUp className="size-5 text-accent-gold" />
          </div>
          <div>
            <h3 className="mb-0.5 font-semibold">Upgrade to Pro</h3>
            <span className="flex flex-col text-muted-foreground text-sm leading-normal sm:flex-row sm:space-y-0">
              <span>Track up to {proMaxDomains} domains</span>
              <span className="mx-1 hidden sm:block">•</span>
              <span>
                <span className="font-medium text-accent-gold">
                  {PRO_TIER_INFO.monthly.label}
                </span>{" "}
                or{" "}
                <span className="font-medium text-accent-gold">
                  {PRO_TIER_INFO.yearly.label}
                </span>
              </span>
            </span>
          </div>
        </div>

        {/* Right side - CTA */}
        <Button
          onClick={handleUpgrade}
          disabled={isLoading}
          className="shrink-0 cursor-pointer"
        >
          {isLoading ? <Spinner /> : <Gem className="size-4" />}
          {isLoading ? "Opening..." : "Get Pro"}
        </Button>
      </div>
    </div>
  );
}

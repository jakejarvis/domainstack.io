"use client";

import { Crown, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useUpgradeCheckout } from "@/hooks/use-upgrade-checkout";
import { PRO_TIER_INFO } from "@/lib/polar/products";

export function UpgradeBanner() {
  const { handleUpgrade, isLoading } = useUpgradeCheckout();

  return (
    <div className="relative overflow-hidden rounded-b-xl border border-accent-purple/30 bg-gradient-to-r from-accent-purple/15 via-accent-purple/10 to-accent-blue/15 p-4">
      {/* Decorative elements */}
      <div
        aria-hidden
        className="-right-16 -top-16 pointer-events-none absolute size-32 rounded-full bg-accent-purple/20 blur-3xl"
      />
      <div
        aria-hidden
        className="-bottom-16 -left-16 pointer-events-none absolute size-24 rounded-full bg-accent-blue/20 blur-3xl"
      />

      <div className="relative flex flex-col items-center justify-between gap-4 sm:flex-row">
        {/* Left side - Icon and text */}
        <div className="flex items-center gap-4">
          <div className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-accent-purple/20">
            <Crown className="size-5 text-accent-purple" />
          </div>
          <div>
            <h3 className="font-semibold">Upgrade to Pro</h3>
            <p className="text-muted-foreground text-sm">
              Track up to 50 domains •{" "}
              <span className="text-accent-purple">
                {PRO_TIER_INFO.monthly.label}
              </span>{" "}
              or{" "}
              <span className="text-accent-purple">
                {PRO_TIER_INFO.yearly.label}
              </span>
            </p>
          </div>
        </div>

        {/* Right side - CTA */}
        <Button
          onClick={handleUpgrade}
          disabled={isLoading}
          className="w-full bg-accent-purple hover:bg-accent-purple/90 sm:w-auto"
        >
          <Sparkles className="size-4" />
          {isLoading ? "Opening..." : "Get Pro"}
        </Button>
      </div>
    </div>
  );
}

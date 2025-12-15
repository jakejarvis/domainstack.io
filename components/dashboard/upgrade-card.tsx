"use client";

import { CircleFadingArrowUp, ShoppingCart } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Spinner } from "@/components/ui/spinner";
import { useUpgradeCheckout } from "@/hooks/use-upgrade-checkout";
import { PRO_TIER_INFO } from "@/lib/polar/products";

type UpgradeCardProps = {
  proMaxDomains: number;
};

export function UpgradeCard({ proMaxDomains }: UpgradeCardProps) {
  const { handleUpgrade, isLoading } = useUpgradeCheckout();

  return (
    <Card className="relative flex h-full flex-col overflow-hidden rounded-xl border border-black/10 bg-gradient-to-br from-black/[0.02] via-transparent to-black/[0.03] py-0 dark:border-white/10 dark:from-white/[0.03] dark:via-transparent dark:to-white/[0.02]">
      {/* Decorative elements - subtle warm glows */}
      <div
        aria-hidden
        className="-right-8 -top-8 pointer-events-none absolute size-32 rounded-full bg-accent-gold/15 blur-3xl"
      />
      <div
        aria-hidden
        className="-bottom-8 -left-8 pointer-events-none absolute size-24 rounded-full bg-accent-gold-muted/20 blur-3xl"
      />

      <CardContent className="relative flex h-full flex-1 flex-col items-center gap-6 p-6 text-center">
        <div className="flex h-full flex-1 flex-col items-center justify-center">
          {/* Icon */}
          <div className="mb-4 flex size-14 items-center justify-center rounded-2xl bg-accent-gold/5 dark:bg-white/5">
            <CircleFadingArrowUp className="size-7 text-accent-gold" />
          </div>

          {/* Heading */}
          <h3 className="mb-2 font-semibold text-lg">Upgrade to Pro</h3>

          {/* Value prop */}
          <p className="mb-4 text-muted-foreground text-sm">
            Track up to {proMaxDomains} domains with priority notifications.
          </p>

          {/* Pricing */}
          <div className="flex items-center gap-2 text-sm">
            <span className="font-medium text-accent-gold">
              {PRO_TIER_INFO.monthly.label}
            </span>
            <span className="text-muted-foreground">or</span>
            <span className="font-medium text-accent-gold">
              {PRO_TIER_INFO.yearly.label}
            </span>
          </div>
        </div>

        {/* CTA Button - pushed to bottom */}
        <Button
          onClick={handleUpgrade}
          disabled={isLoading}
          variant="outline"
          className="w-full cursor-pointer"
        >
          {isLoading ? <Spinner /> : <ShoppingCart className="size-4" />}
          {isLoading ? "Opening..." : "Get Pro"}
        </Button>
      </CardContent>
    </Card>
  );
}

"use client";

import { Gauge, Gem } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Spinner } from "@/components/ui/spinner";
import { useSubscription } from "@/hooks/use-subscription";
import { useUpgradeCheckout } from "@/hooks/use-upgrade-checkout";

export function UpgradePrompt() {
  const {
    subscription,
    isPro,
    isLoading: isLoadingSubscription,
  } = useSubscription();
  const { handleUpgrade, isLoading: isCheckoutLoading } = useUpgradeCheckout();

  // Don't show while loading, if already on Pro, or if subscription data unavailable
  if (isLoadingSubscription || !subscription || isPro) return null;

  const { activeCount, maxDomains } = subscription;

  // Show prompt when at 80% capacity or at limit
  const nearLimit = activeCount >= maxDomains * 0.8;
  const atLimit = activeCount >= maxDomains;

  if (!nearLimit) return null;

  return (
    <Card className="relative overflow-hidden border-black/10 bg-gradient-to-br from-black/[0.02] to-black/[0.04] dark:border-white/10 dark:from-white/[0.02] dark:to-white/[0.04]">
      {/* Decorative elements - subtle warm glows */}
      <div
        aria-hidden
        className="-right-8 -top-8 pointer-events-none absolute size-32 rounded-full bg-accent-gold/15 blur-3xl"
      />
      <div
        aria-hidden
        className="-bottom-8 -left-8 pointer-events-none absolute size-24 rounded-full bg-accent-gold-muted/20 blur-3xl"
      />

      <CardHeader className="relative flex flex-col items-start justify-between gap-4 space-y-0 sm:flex-row sm:items-center">
        <div className="flex-1 space-y-1.5">
          <div className="flex items-center gap-2">
            <div className="flex size-10 items-center justify-center rounded-xl bg-accent-gold/5 dark:bg-white/5">
              <Gauge className="size-5 text-accent-gold" />
            </div>
            <CardTitle className="text-lg">
              {atLimit ? "Domain Limit Reached" : "Approaching Limit"}
            </CardTitle>
          </div>
          <CardDescription>
            {atLimit
              ? `You've reached your limit of ${maxDomains} tracked domains.`
              : `You're using ${activeCount} of ${maxDomains} domain slots.`}{" "}
            Upgrade to Pro for more capacity.
          </CardDescription>
        </div>
        <Button
          onClick={handleUpgrade}
          disabled={isCheckoutLoading}
          className="w-full shrink-0 cursor-pointer bg-foreground text-background hover:bg-foreground/90 sm:w-auto"
        >
          {isCheckoutLoading ? <Spinner /> : <Gem className="size-4" />}
          {isCheckoutLoading ? "Opening..." : "Upgrade to Pro"}
        </Button>
      </CardHeader>
    </Card>
  );
}

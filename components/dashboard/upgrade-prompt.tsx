"use client";

import { Crown } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Spinner } from "@/components/ui/spinner";
import { useUpgradeCheckout } from "@/hooks/use-upgrade-checkout";
import { PRO_TIER_INFO } from "@/lib/polar/products";
import type { UserTier } from "@/lib/schemas";

type UpgradePromptProps = {
  currentCount: number;
  maxDomains: number;
  proMaxDomains: number;
  tier: UserTier;
};

export function UpgradePrompt({
  currentCount,
  maxDomains,
  proMaxDomains,
  tier,
}: UpgradePromptProps) {
  const { handleUpgrade, isLoading } = useUpgradeCheckout();

  // Don't show if already on Pro or not near limit
  if (tier === "pro") return null;

  // Show prompt when at 80% capacity or at limit
  const nearLimit = currentCount >= maxDomains * 0.8;
  const atLimit = currentCount >= maxDomains;

  if (!nearLimit) return null;

  return (
    <Card className="border-black/10 bg-gradient-to-br from-black/[0.02] to-black/[0.04] dark:border-white/10 dark:from-white/[0.02] dark:to-white/[0.04]">
      <CardHeader className="pb-3">
        <div className="flex items-center gap-2">
          <Crown className="size-5 text-accent-gold" />
          <CardTitle className="text-lg">
            {atLimit ? "Domain Limit Reached" : "Running Low on Slots"}
          </CardTitle>
        </div>
        <CardDescription>
          {atLimit
            ? `You've reached your limit of ${maxDomains} tracked domains.`
            : `You're using ${currentCount} of ${maxDomains} domain slots.`}{" "}
          Upgrade to Pro for more capacity.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="text-muted-foreground text-sm">
          <span className="font-medium text-foreground">
            {PRO_TIER_INFO.name}
          </span>
          : Track up to {proMaxDomains} domains •{" "}
          <span className="font-medium text-accent-gold">
            {PRO_TIER_INFO.monthly.label}
          </span>{" "}
          or{" "}
          <span className="font-medium text-accent-gold">
            {PRO_TIER_INFO.yearly.label}
          </span>{" "}
          <span className="text-muted-foreground/70">
            ({PRO_TIER_INFO.yearly.savings})
          </span>
        </div>
        <Button
          onClick={handleUpgrade}
          disabled={isLoading}
          className="bg-foreground text-background hover:bg-foreground/90"
        >
          {isLoading ? <Spinner /> : <Crown className="size-4" />}
          {isLoading ? "Opening..." : "Upgrade to Pro"}
        </Button>
      </CardContent>
    </Card>
  );
}

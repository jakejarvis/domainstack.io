"use client";

import { Crown } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { checkout } from "@/lib/auth-client";
import { logger } from "@/lib/logger/client";
import { PRO_TIER_INFO } from "@/lib/polar/products";
import type { UserTier } from "@/lib/schemas";

type UpgradePromptProps = {
  currentCount: number;
  maxDomains: number;
  tier: UserTier;
};

export function UpgradePrompt({
  currentCount,
  maxDomains,
  tier,
}: UpgradePromptProps) {
  const [isLoading, setIsLoading] = useState(false);

  // Don't show if already on Pro or not near limit
  if (tier === "pro") return null;

  // Show prompt when at 80% capacity or at limit
  const nearLimit = currentCount >= maxDomains * 0.8;
  const atLimit = currentCount >= maxDomains;

  if (!nearLimit) return null;

  const handleUpgrade = async () => {
    setIsLoading(true);
    try {
      // Open Polar checkout - pass both products so user can choose interval
      await checkout({
        products: [
          PRO_TIER_INFO.monthly.productId,
          PRO_TIER_INFO.yearly.productId,
        ],
      });
    } catch (err) {
      logger.error("Failed to open checkout", err);
      toast.error("Failed to open checkout. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Card className="border-accent-purple/20 bg-gradient-to-br from-accent-purple/5 to-accent-blue/5">
      <CardHeader className="pb-3">
        <div className="flex items-center gap-2">
          <Crown className="size-5 text-accent-purple" />
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
          : Track up to 50 domains •{" "}
          <span className="text-accent-purple">
            {PRO_TIER_INFO.monthly.label}
          </span>{" "}
          or{" "}
          <span className="text-accent-purple">
            {PRO_TIER_INFO.yearly.label}
          </span>{" "}
          <span className="text-muted-foreground/70">
            ({PRO_TIER_INFO.yearly.savings})
          </span>
        </div>
        <Button
          onClick={handleUpgrade}
          disabled={isLoading}
          className="bg-accent-purple hover:bg-accent-purple/90"
        >
          <Crown className="size-4" />
          {isLoading ? "Opening..." : "Upgrade to Pro"}
        </Button>
      </CardContent>
    </Card>
  );
}

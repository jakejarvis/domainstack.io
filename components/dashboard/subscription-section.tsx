"use client";

import { Crown, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { useCustomerPortal } from "@/hooks/use-customer-portal";
import { useUpgradeCheckout } from "@/hooks/use-upgrade-checkout";
import { PRO_TIER_INFO } from "@/lib/polar/products";
import type { UserTier } from "@/lib/schemas";

type SubscriptionSectionProps = {
  tier: UserTier;
  activeCount: number;
  maxDomains: number;
};

export function SubscriptionSection({
  tier,
  activeCount,
  maxDomains,
}: SubscriptionSectionProps) {
  const { handleUpgrade, isLoading: isCheckoutLoading } = useUpgradeCheckout();
  const { openPortal: handleManageSubscription, isLoading: isPortalLoading } =
    useCustomerPortal();

  const isPro = tier === "pro";
  const percentage = maxDomains > 0 ? (activeCount / maxDomains) * 100 : 0;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          {isPro && <Crown className="size-5 text-accent-purple" />}
          Subscription
        </CardTitle>
        <CardDescription>
          {isPro
            ? "You're on the Pro plan. Thank you for your support!"
            : "Upgrade to Pro for more tracked domains."}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Current plan info */}
        <div className="flex items-center justify-between rounded-lg border bg-muted/50 p-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="font-medium">{isPro ? "Pro" : "Free"} Plan</span>
              {isPro && (
                <span className="rounded-full bg-accent-purple/10 px-2 py-0.5 text-accent-purple text-xs">
                  Active
                </span>
              )}
            </div>
            <p className="text-muted-foreground text-sm">
              {activeCount} of {maxDomains} domains used
            </p>
          </div>
          <Progress value={percentage} className="w-24" />
        </div>

        {/* Actions */}
        {isPro ? (
          <Button
            variant="outline"
            onClick={handleManageSubscription}
            disabled={isPortalLoading}
            className="w-full"
          >
            <ExternalLink className="size-4" />
            {isPortalLoading ? "Opening..." : "Manage Subscription"}
          </Button>
        ) : (
          <div className="space-y-3">
            <div className="rounded-lg border border-accent-purple/20 bg-gradient-to-br from-accent-purple/5 to-accent-blue/5 p-4">
              <div className="mb-2 font-medium">{PRO_TIER_INFO.name}</div>
              <ul className="mb-3 space-y-1 text-muted-foreground text-sm">
                {PRO_TIER_INFO.features.map((feature) => (
                  <li key={feature}>• {feature}</li>
                ))}
              </ul>
              <div className="flex items-baseline gap-2 text-sm">
                <span className="font-semibold text-accent-purple">
                  {PRO_TIER_INFO.monthly.label}
                </span>
                <span className="text-muted-foreground">or</span>
                <span className="font-semibold text-accent-purple">
                  {PRO_TIER_INFO.yearly.label}
                </span>
                <span className="text-muted-foreground/70 text-xs">
                  ({PRO_TIER_INFO.yearly.savings})
                </span>
              </div>
            </div>
            <Button
              onClick={handleUpgrade}
              disabled={isCheckoutLoading}
              className="w-full bg-accent-purple hover:bg-accent-purple/90"
            >
              <Crown className="size-4" />
              {isCheckoutLoading ? "Opening..." : "Upgrade to Pro"}
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

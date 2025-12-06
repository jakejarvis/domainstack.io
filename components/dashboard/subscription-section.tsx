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
import { getProTierInfo } from "@/lib/polar/products";
import type { UserTier } from "@/lib/schemas";
import { cn } from "@/lib/utils";

type SubscriptionSectionProps = {
  tier: UserTier;
  activeCount: number;
  maxDomains: number;
  proMaxDomains: number;
  /** Whether to show the card wrapper (false for modal usage) */
  showCard?: boolean;
};

export function SubscriptionSection({
  tier,
  activeCount,
  maxDomains,
  proMaxDomains,
  showCard = true,
}: SubscriptionSectionProps) {
  const { handleUpgrade, isLoading: isCheckoutLoading } = useUpgradeCheckout();
  const { openPortal: handleManageSubscription, isLoading: isPortalLoading } =
    useCustomerPortal();

  const isPro = tier === "pro";
  const percentage =
    maxDomains > 0 ? Math.min((activeCount / maxDomains) * 100, 100) : 0;
  const proTierInfo = getProTierInfo(proMaxDomains);

  const content = (
    <>
      <CardHeader className={cn(!showCard && "px-0 pt-0")}>
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
      <CardContent className={cn("space-y-4", !showCard && "px-0 pb-0")}>
        {/* Current plan info */}
        <div className="flex items-center justify-between rounded-xl border border-black/10 bg-muted/30 p-4 dark:border-white/10">
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
          <Progress
            value={percentage}
            className="w-24"
            aria-label="Domain usage"
            aria-valuetext={`${activeCount} of ${maxDomains} domains used`}
          />
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
            <div className="rounded-xl border border-accent-purple/20 bg-gradient-to-br from-accent-purple/5 to-accent-blue/5 p-4">
              <div className="mb-2 font-medium">{proTierInfo.name}</div>
              <ul className="mb-3 space-y-1 text-muted-foreground text-sm">
                {proTierInfo.features.map((feature) => (
                  <li key={feature}>• {feature}</li>
                ))}
              </ul>
              <div className="flex items-baseline gap-2 text-sm">
                <span className="font-semibold text-accent-purple">
                  {proTierInfo.monthly.label}
                </span>
                <span className="text-muted-foreground">or</span>
                <span className="font-semibold text-accent-purple">
                  {proTierInfo.yearly.label}
                </span>
                <span className="text-muted-foreground/70 text-xs">
                  ({proTierInfo.yearly.savings})
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
    </>
  );

  if (!showCard) {
    return <div className="flex flex-col">{content}</div>;
  }

  return <Card>{content}</Card>;
}

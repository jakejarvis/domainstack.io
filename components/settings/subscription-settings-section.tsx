"use client";

import { format } from "date-fns";
import { ExternalLink, ShoppingCart } from "lucide-react";
import { SubscriptionSkeleton } from "@/components/settings/settings-skeleton";
import { Button } from "@/components/ui/button";
import {
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Spinner } from "@/components/ui/spinner";
import { useCustomerPortal } from "@/hooks/use-customer-portal";
import { useSubscription } from "@/hooks/use-subscription";
import { useUpgradeCheckout } from "@/hooks/use-upgrade-checkout";
import { DEFAULT_TIER_LIMITS } from "@/lib/constants";
import { getProTierInfo } from "@/lib/polar/products";
import { cn } from "@/lib/utils";

export function SubscriptionSettingsSection() {
  // Subscription hooks
  const { handleUpgrade, isLoading: isCheckoutLoading } = useUpgradeCheckout();
  const { openPortal: handleManageSubscription, isLoading: isPortalLoading } =
    useCustomerPortal();

  // Query
  const { subscription, isPro, isLoading, isError } = useSubscription();

  if (isLoading) {
    return <SubscriptionSkeleton showCard={false} />;
  }

  if (isError) {
    return (
      <div>
        <CardHeader className="px-0 pt-0 pb-2">
          <CardTitle>Subscription</CardTitle>
          <CardDescription className="text-destructive">
            Failed to load subscription information
          </CardDescription>
        </CardHeader>
      </div>
    );
  }

  const activeCount = subscription?.activeCount ?? 0;
  const maxDomains = subscription?.maxDomains ?? DEFAULT_TIER_LIMITS.free;
  const proMaxDomains = subscription?.proMaxDomains ?? DEFAULT_TIER_LIMITS.pro;
  const subscriptionEndsAt = subscription?.subscriptionEndsAt ?? null;
  const percentage =
    maxDomains > 0 ? Math.min((activeCount / maxDomains) * 100, 100) : 0;
  const proTierInfo = getProTierInfo(proMaxDomains);

  return (
    <div>
      <CardHeader className="px-0 pt-0 pb-2">
        <CardTitle>Subscription</CardTitle>
        <CardDescription>
          {isPro
            ? "You're on the Pro plan. Thank you for your support!"
            : "Upgrade to Pro for more tracked domains."}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4 px-0 pt-1">
        {/* Current plan info */}
        <div className="flex items-center justify-between rounded-xl border border-black/10 bg-muted/30 p-4 dark:border-white/10">
          <div>
            <div className="flex items-center gap-2">
              <span className="font-medium">{isPro ? "Pro" : "Free"} Plan</span>
              {isPro && (
                <span
                  className={cn(
                    "rounded-full px-2 py-0.5 font-medium text-xs",
                    subscriptionEndsAt
                      ? "bg-amber-500/10 text-amber-600 dark:text-amber-400"
                      : "bg-accent-gold/10 text-accent-gold",
                  )}
                >
                  {subscriptionEndsAt
                    ? `Ends ${format(subscriptionEndsAt, "MMM d")}`
                    : "Active"}
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
          <div className="space-y-2">
            <Button
              variant="outline"
              onClick={handleManageSubscription}
              disabled={isPortalLoading}
              className="w-full"
            >
              {isPortalLoading ? (
                <Spinner />
              ) : (
                <ExternalLink className="size-4" />
              )}
              {isPortalLoading ? "Opening..." : "Manage Subscription"}
            </Button>
            {subscriptionEndsAt && (
              <p className="text-center text-muted-foreground text-xs">
                Your Pro access continues until{" "}
                {format(subscriptionEndsAt, "MMMM d, yyyy")}
              </p>
            )}
          </div>
        ) : (
          <div className="relative overflow-hidden rounded-xl border border-black/10 bg-gradient-to-br from-black/[0.02] to-black/[0.04] p-4 dark:border-white/10 dark:from-white/[0.02] dark:to-white/[0.04]">
            {/* Decorative elements - subtle warm glows */}
            <div
              aria-hidden
              className="-right-8 -top-8 pointer-events-none absolute size-32 rounded-full bg-accent-gold/15 blur-3xl"
            />
            <div
              aria-hidden
              className="-bottom-8 -left-8 pointer-events-none absolute size-24 rounded-full bg-accent-gold-muted/20 blur-3xl"
            />

            <div className="relative">
              <div className="mb-2 font-medium">{proTierInfo.name}</div>
              <ul className="mb-3 space-y-1 text-muted-foreground text-sm">
                {proTierInfo.features.map((feature) => (
                  <li key={feature}>• {feature}</li>
                ))}
              </ul>
              <div className="mb-4 flex items-baseline gap-2 text-sm">
                <span className="font-semibold text-accent-gold">
                  {proTierInfo.monthly.label}
                </span>
                <span className="text-muted-foreground">or</span>
                <span className="font-semibold text-accent-gold">
                  {proTierInfo.yearly.label}
                </span>
                <span className="text-muted-foreground/70 text-xs">
                  ({proTierInfo.yearly.savings})
                </span>
              </div>
              <Button
                onClick={handleUpgrade}
                disabled={isCheckoutLoading}
                className="w-full cursor-pointer bg-foreground text-background hover:bg-foreground/90"
              >
                {isCheckoutLoading ? (
                  <Spinner />
                ) : (
                  <ShoppingCart className="size-4" />
                )}
                {isCheckoutLoading ? "Opening..." : "Upgrade to Pro"}
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </div>
  );
}

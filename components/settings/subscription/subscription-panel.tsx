import {
  CreditCardIcon,
  GaugeIcon,
  GiftIcon,
  RocketLaunchIcon,
  ShootingStarIcon,
} from "@phosphor-icons/react/ssr";
import { format } from "date-fns";
import { QuotaBar } from "@/components/dashboard/quota-bar";
import { SubscriptionSkeleton } from "@/components/settings/settings-skeleton";
import { Button } from "@/components/ui/button";
import {
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Spinner } from "@/components/ui/spinner";
import { UpgradeButton } from "@/components/upgrade-button";
import { useSubscription } from "@/hooks/use-subscription";
import { PLAN_QUOTAS } from "@/lib/constants/plan-quotas";
import { PRO_TIER_INFO } from "@/lib/polar/products";
import { cn } from "@/lib/utils";

export function SubscriptionPanel() {
  // Subscription query and hooks
  const {
    subscription,
    isPro,
    isSubscriptionLoading,
    isSubscriptionError,
    handleCustomerPortal,
    isCustomerPortalLoading,
  } = useSubscription();

  if (isSubscriptionLoading) {
    return <SubscriptionSkeleton />;
  }

  if (isSubscriptionError) {
    return (
      <CardHeader className="px-0 pt-0 pb-2">
        <CardTitle className="mb-1 flex items-center gap-2 leading-none">
          <GaugeIcon className="size-4.5" />
          Plan
        </CardTitle>
        <CardDescription className="text-destructive">
          Failed to load subscription information
        </CardDescription>
      </CardHeader>
    );
  }

  return (
    <div className="max-w-full overflow-x-hidden">
      <CardHeader className="px-0 pt-0 pb-2">
        <CardTitle className="mb-1 flex items-center gap-2 leading-none">
          <GaugeIcon className="size-4.5" />
          Plan
        </CardTitle>
        <CardDescription>
          {isPro
            ? "You're on the Pro plan. Thank you for your support!"
            : "Upgrade to Pro for more tracked domains."}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4 px-0 pt-2">
        {/* Current plan info */}
        <div className="flex items-center justify-between rounded-md border border-black/10 bg-muted/30 p-4 dark:border-white/10">
          <div>
            <div className="mb-2 flex items-center gap-2">
              {isPro ? (
                <ShootingStarIcon className="size-4 text-foreground/80" />
              ) : (
                <GiftIcon className="size-4 text-foreground/80" />
              )}
              <span className="font-medium">{isPro ? "Pro" : "Free"} Plan</span>
              {isPro && (
                <span
                  className={cn(
                    "rounded-full px-2 py-0.5 font-medium text-xs",
                    subscription?.endsAt
                      ? "bg-amber-500/10 text-amber-600 dark:text-amber-400"
                      : "bg-accent-gold/10 text-accent-gold",
                  )}
                >
                  {subscription?.endsAt
                    ? `Ends ${format(subscription?.endsAt, "MMM d")}`
                    : "Active"}
                </span>
              )}
            </div>
            <p className="text-muted-foreground text-sm">
              {subscription?.activeCount} of {subscription?.planQuota} domains
              used
            </p>
          </div>
          {subscription && (
            <QuotaBar
              used={subscription.activeCount}
              planQuota={subscription.planQuota}
              className="w-24"
            />
          )}
        </div>

        {/* Actions */}
        {isPro ? (
          <div className="space-y-2">
            <Button
              variant="outline"
              onClick={handleCustomerPortal}
              disabled={isCustomerPortalLoading}
              className="w-full"
            >
              {isCustomerPortalLoading ? (
                <>
                  <Spinner />
                  Loading…
                </>
              ) : (
                <>
                  <CreditCardIcon />
                  Manage Subscription
                </>
              )}
            </Button>
            {subscription?.endsAt && (
              <p className="text-center text-muted-foreground text-xs">
                Your Pro access continues until{" "}
                {format(subscription?.endsAt, "MMMM d, yyyy")}
              </p>
            )}
          </div>
        ) : (
          <div className="relative overflow-hidden rounded-md border border-black/10 bg-gradient-to-br from-black/[0.02] to-black/[0.04] p-4 dark:border-white/10 dark:from-white/[0.02] dark:to-white/[0.04]">
            {/* Decorative elements - subtle warm glows */}
            <div
              aria-hidden
              className="pointer-events-none absolute -top-8 -right-8 size-32 rounded-full bg-accent-gold/15 blur-3xl"
            />
            <div
              aria-hidden
              className="pointer-events-none absolute -bottom-8 -left-8 size-24 rounded-full bg-accent-gold-muted/20 blur-3xl"
            />

            <div className="relative">
              <div className="mb-2 flex items-center gap-2 font-medium">
                <ShootingStarIcon className="size-4 text-foreground/80" />
                {PRO_TIER_INFO.name} Plan
              </div>
              <ul className="mb-3 space-y-1 text-muted-foreground text-sm">
                <li>Track up to {PLAN_QUOTAS.pro} domains</li>
                <li>Priority email notifications</li>
                <li>Support development</li>
              </ul>
              <div className="mb-4 flex items-baseline gap-2 text-sm">
                <span className="font-semibold text-accent-gold">
                  {PRO_TIER_INFO.monthly.label}
                </span>
                <span className="text-muted-foreground">or</span>
                <span className="font-semibold text-accent-gold">
                  {PRO_TIER_INFO.yearly.label}
                </span>
                <span className="text-muted-foreground/70 text-xs">
                  ({PRO_TIER_INFO.yearly.savings})
                </span>
              </div>
              <UpgradeButton className="w-full">
                <RocketLaunchIcon />
                Upgrade to Pro
              </UpgradeButton>
            </div>
          </div>
        )}
      </CardContent>
    </div>
  );
}

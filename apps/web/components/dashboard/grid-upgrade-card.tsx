import { PLAN_QUOTAS } from "@domainstack/constants";
import { PRO_TIER_INFO } from "@domainstack/polar/products";
import { Card, CardContent } from "@domainstack/ui/card";
import { IconCircleArrowUp, IconRocket } from "@tabler/icons-react";
import { UpgradeButton } from "@/components/upgrade-button";
import { useSubscription } from "@/hooks/use-subscription";

export function GridUpgradeCard() {
  const { isPro, isSubscriptionLoading } = useSubscription();

  // Don't show if already a Pro user or still loading
  if (isSubscriptionLoading || isPro) {
    return null;
  }

  return (
    <Card className="relative flex h-full flex-col overflow-hidden rounded-xl border border-black/10 bg-gradient-to-br from-black/[0.02] via-transparent to-black/[0.03] py-0 dark:border-white/10 dark:from-white/[0.03] dark:via-transparent dark:to-white/[0.02]">
      {/* Decorative elements - subtle ambient glows */}
      <div
        aria-hidden
        className="pointer-events-none absolute -top-12 -right-20 size-48 rounded-full bg-accent-gold/8 blur-[60px]"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -bottom-8 left-4 size-28 rounded-full bg-accent-gold-muted/8 blur-[60px]"
      />

      <CardContent className="relative flex h-full flex-1 flex-col items-center gap-6 p-6 text-center">
        <div className="flex h-full flex-1 flex-col items-center justify-center">
          {/* Icon */}
          <div className="mb-4 flex size-14 items-center justify-center rounded-xl bg-accent-gold/5 dark:bg-white/5">
            <IconCircleArrowUp className="size-7 text-accent-gold" />
          </div>

          {/* Heading */}
          <h3 className="mb-2 font-semibold text-lg">Upgrade to Pro</h3>

          {/* Value prop */}
          <p className="mb-4 text-muted-foreground text-sm">
            Track up to {PLAN_QUOTAS.pro} domains with priority notifications.
          </p>

          {/* Pricing */}
          <div className="flex items-center gap-1.5 text-sm">
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
        <UpgradeButton variant="outline" className="w-full" icon={IconRocket}>
          Get Pro
        </UpgradeButton>
      </CardContent>
    </Card>
  );
}

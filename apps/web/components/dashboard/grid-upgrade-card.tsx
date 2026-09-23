import { IconCircleArrowUp, IconRocket } from "@tabler/icons-react";

import { UpgradeButton } from "@/components/upgrade-button";
import { useSubscription } from "@/hooks/use-subscription";
import { PLAN_QUOTAS } from "@domainstack/constants";
import { PRO_TIER_INFO } from "@domainstack/polar/products";
import { Card, CardContent } from "@domainstack/ui/card";

export function GridUpgradeCard() {
  const { isPro, isSubscriptionLoading } = useSubscription();

  if (isSubscriptionLoading || isPro) {
    return null;
  }

  return (
    <Card className="flex h-full flex-col rounded-xl border-accent-gold/25 bg-background bg-linear-to-bl from-accent-gold/10 to-transparent to-60% py-0">
      <CardContent className="flex h-full flex-1 flex-col items-center gap-6 p-6 text-center">
        <div className="flex h-full flex-1 flex-col items-center justify-center">
          <div className="mb-4 flex size-14 items-center justify-center rounded-xl bg-accent-gold/10 ring-1 ring-accent-gold/20 ring-inset">
            <IconCircleArrowUp className="size-7 text-accent-gold" />
          </div>

          <h3 className="mb-2 text-lg font-semibold">Upgrade to Pro</h3>

          <p className="mb-4 text-sm text-muted-foreground">
            Track up to {PLAN_QUOTAS.pro} domains with priority notifications.
          </p>

          <div className="flex items-center gap-1.5 text-sm">
            <span className="font-medium text-accent-gold">{PRO_TIER_INFO.monthly.label}</span>
            <span className="text-muted-foreground">or</span>
            <span className="font-medium text-accent-gold">{PRO_TIER_INFO.yearly.label}</span>
          </div>
        </div>

        <UpgradeButton variant="outline" className="w-full" icon={IconRocket}>
          Get Pro
        </UpgradeButton>
      </CardContent>
    </Card>
  );
}

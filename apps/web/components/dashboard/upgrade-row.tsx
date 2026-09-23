import { IconCircleArrowUp, IconRocket } from "@tabler/icons-react";

import { UpgradeButton } from "@/components/upgrade-button";
import { useSubscription } from "@/hooks/use-subscription";
import { PLAN_QUOTAS } from "@domainstack/constants";
import { PRO_TIER_INFO } from "@domainstack/polar/products";

export function UpgradeRow() {
  const { isPro, isSubscriptionLoading } = useSubscription();

  if (isSubscriptionLoading || isPro) {
    return null;
  }

  return (
    <div className="flex flex-col items-start justify-between gap-4 border-t border-accent-gold/25 bg-linear-to-r from-accent-gold/10 to-transparent to-50% p-4 md:flex-row md:items-center">
      <div className="flex items-center gap-4">
        <div className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-accent-gold/10 ring-1 ring-accent-gold/20 ring-inset">
          <IconCircleArrowUp className="size-5 text-accent-gold" />
        </div>
        <div>
          <h3 className="leading-snug font-semibold">Upgrade to Pro</h3>
          <span className="text-[13px] text-muted-foreground">
            Track <span className="hidden sm:inline">up to </span>
            {PLAN_QUOTAS.pro} domains
            <span className="mx-1">•</span>
            <span className="font-medium text-accent-gold">
              {PRO_TIER_INFO.monthly.label}
            </span> or{" "}
            <span className="font-medium text-accent-gold">{PRO_TIER_INFO.yearly.label}</span>
          </span>
        </div>
      </div>

      <UpgradeButton variant="outline" className="w-full shrink-0 md:w-auto" icon={IconRocket}>
        Get Pro
      </UpgradeButton>
    </div>
  );
}

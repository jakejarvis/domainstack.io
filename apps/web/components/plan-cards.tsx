import { IconRocket } from "@tabler/icons-react";

import { UpgradeButton } from "@/components/upgrade-button";
import { PLAN_QUOTAS } from "@domainstack/constants";
import { PRO_TIER_INFO } from "@domainstack/polar/products";
import { cn } from "@domainstack/ui/utils";

const PRO_YEARLY_NOTE = `or ${PRO_TIER_INFO.yearly.label}`;

/** Pro pricing as one line, for upgrade prompts. */
export const PRO_PRICE_SUMMARY = `${PRO_TIER_INFO.monthly.label} ${PRO_YEARLY_NOTE}`;

/** Compact Pro upgrade row: quota on the left, price and upgrade button on the right. */
export function ProUpsell({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "@container rounded-xl border border-accent-gold/25 bg-linear-to-bl from-accent-gold/10 to-transparent to-60% p-4",
        className,
      )}
    >
      <div className="flex flex-col gap-3 @sm:flex-row @sm:items-center @sm:justify-between">
        <div className="min-w-0 space-y-0.5">
          <h3 className="font-medium">{PRO_TIER_INFO.name}</h3>
          <p className="text-[13px] text-muted-foreground">
            Up to{" "}
            <span className="font-medium text-foreground tabular-nums">{PLAN_QUOTAS.pro}</span>{" "}
            tracked domains
          </p>
        </div>
        <div className="flex items-center justify-between gap-4 @sm:justify-end">
          <p className="leading-tight @sm:text-right">
            <span className="font-semibold tabular-nums">{PRO_TIER_INFO.monthly.label}</span>
            <span className="block text-xs text-muted-foreground">{PRO_YEARLY_NOTE}</span>
          </p>
          <UpgradeButton size="sm" icon={IconRocket}>
            Upgrade
          </UpgradeButton>
        </div>
      </div>
    </div>
  );
}

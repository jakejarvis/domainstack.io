import { IconRocket, IconShoppingCart } from "@tabler/icons-react";

import { UpgradeButton } from "@/components/upgrade-button";
import { PLAN_QUOTAS } from "@domainstack/constants";
import { PRO_TIER_INFO } from "@domainstack/polar/products";
import { cn } from "@domainstack/ui/utils";

interface UpgradeCardProps {
  className?: string;
}

export function UpgradeCard({ className }: UpgradeCardProps) {
  return (
    <div
      className={cn(
        "space-y-3 rounded-lg border border-accent-gold/25 bg-background bg-linear-to-bl from-accent-gold/10 to-transparent to-60% p-4",
        className,
      )}
    >
      <div className="mb-2 flex items-center gap-2 font-medium">
        <IconRocket className="size-4 text-accent-gold" />
        {PRO_TIER_INFO.name} Plan
      </div>
      <ul className="list-disc space-y-1 pl-4 text-[13px] text-muted-foreground marker:text-muted-foreground/80">
        <li>Track up to {PLAN_QUOTAS.pro} domains</li>
        <li>Priority email notifications</li>
        <li>Support development</li>
      </ul>
      <div className="flex items-baseline gap-1.5 text-sm">
        <span className="font-semibold text-accent-gold">{PRO_TIER_INFO.monthly.label}</span>
        <span className="text-muted-foreground">or</span>
        <span className="font-semibold text-accent-gold">{PRO_TIER_INFO.yearly.label}</span>
        <span className="text-xs text-muted-foreground/95 lowercase">
          ({PRO_TIER_INFO.yearly.savings})
        </span>
      </div>
      <UpgradeButton className="mt-1 w-full" icon={IconShoppingCart}>
        Upgrade to Pro
      </UpgradeButton>
    </div>
  );
}

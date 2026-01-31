import { PLAN_QUOTAS } from "@domainstack/constants";
import { PRO_TIER_INFO } from "@domainstack/polar/products";
import { cn } from "@domainstack/ui/utils";
import { IconRocket, IconShoppingCart } from "@tabler/icons-react";
import { UpgradeButton } from "@/components/upgrade-button";

interface UpgradeCardProps {
  className?: string;
}

export function UpgradeCard({ className }: UpgradeCardProps) {
  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-xl border border-black/10 bg-gradient-to-br from-black/[0.02] to-black/[0.04] p-4 dark:border-white/10 dark:from-white/[0.02] dark:to-white/[0.04]",
        className,
      )}
    >
      {/* Decorative elements - subtle warm glows */}
      <div
        aria-hidden
        className="pointer-events-none absolute -top-8 -right-8 size-32 rounded-full bg-accent-gold/15 blur-3xl"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -bottom-8 -left-8 size-24 rounded-full bg-accent-gold-muted/20 blur-3xl"
      />

      <div className="relative space-y-3">
        <div className="mb-2 flex items-center gap-2 font-medium">
          <IconRocket className="size-4 text-foreground/80" />
          {PRO_TIER_INFO.name} Plan
        </div>
        <ul className="list-disc space-y-1 pl-4 text-[13px] text-muted-foreground marker:text-muted-foreground/80">
          <li>Track up to {PLAN_QUOTAS.pro} domains</li>
          <li>Priority email notifications</li>
          <li>Support development</li>
        </ul>
        <div className="flex items-baseline gap-1.5 text-sm">
          <span className="font-semibold text-accent-gold">
            {PRO_TIER_INFO.monthly.label}
          </span>
          <span className="text-muted-foreground">or</span>
          <span className="font-semibold text-accent-gold">
            {PRO_TIER_INFO.yearly.label}
          </span>
          <span className="text-muted-foreground/95 text-xs lowercase">
            ({PRO_TIER_INFO.yearly.savings})
          </span>
        </div>
        <UpgradeButton className="mt-1 w-full" icon={IconShoppingCart}>
          Upgrade to Pro
        </UpgradeButton>
      </div>
    </div>
  );
}

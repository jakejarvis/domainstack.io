import { IconCheck, IconRocket } from "@tabler/icons-react";

import { UpgradeButton } from "@/components/upgrade-button";
import { PLAN_QUOTAS } from "@domainstack/constants";
import { PRO_TIER_INFO } from "@domainstack/polar/products";
import { Badge } from "@domainstack/ui/badge";
import { cn } from "@domainstack/ui/utils";

// prices are USD, so a fixed locale keeps server and client output identical
const usd = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  minimumFractionDigits: 0,
});

const PRO_MONTHLY_PRICE = usd.format(PRO_TIER_INFO.monthly.amount / 100);
const PRO_YEARLY_NOTE = `or ${PRO_TIER_INFO.yearly.label} (${PRO_TIER_INFO.yearly.savings.toLowerCase()})`;

/** Pro pricing as one line, for upgrade prompts outside the plan cards. */
export const PRO_PRICE_SUMMARY = `${PRO_MONTHLY_PRICE}/month ${PRO_YEARLY_NOTE}`;

// the plans differ only by quota, so everything else is listed once for both
const PLAN_FEATURES = [
  "Domain and SSL certificate expiry alerts",
  "Alerts when the registrar, DNS, hosting, email, or certificate changes",
  "In-app and email notifications",
  "Calendar feed of upcoming expirations",
];

function PlanCard({
  name,
  price,
  period,
  note,
  quota,
  current,
  className,
  children,
}: {
  name: string;
  price: string;
  period?: string;
  note: string;
  quota: number;
  current?: boolean;
  className?: string;
  children?: React.ReactNode;
}) {
  return (
    <div className={cn("flex flex-col gap-4 rounded-xl border bg-card/60 p-4", className)}>
      <div className="flex min-h-5 items-center justify-between gap-2">
        <h3 className="font-medium">{name}</h3>
        {current ? <Badge variant="outline">Current plan</Badge> : null}
      </div>
      <div className="space-y-1">
        <p className="flex items-baseline gap-1">
          <span className="text-2xl font-semibold tracking-tight tabular-nums">{price}</span>
          {period ? <span className="text-sm text-muted-foreground">{period}</span> : null}
        </p>
        <p className="text-[13px] text-muted-foreground">{note}</p>
      </div>
      <p className="text-sm">
        Up to <span className="font-medium tabular-nums">{quota}</span> tracked domains
      </p>
      {children ? <div className="mt-auto">{children}</div> : null}
    </div>
  );
}

export function FreePlanCard({ current }: { current?: boolean }) {
  return (
    <PlanCard
      name="Free"
      price={usd.format(0)}
      note="Free forever"
      quota={PLAN_QUOTAS.free}
      current={current}
    />
  );
}

export function ProPlanCard({ current }: { current?: boolean }) {
  return (
    <PlanCard
      name={PRO_TIER_INFO.name}
      price={PRO_MONTHLY_PRICE}
      period="/month"
      note={PRO_YEARLY_NOTE}
      quota={PLAN_QUOTAS.pro}
      current={current}
      className="border-accent-gold/25 bg-linear-to-bl from-accent-gold/10 to-transparent to-60%"
    >
      {current ? null : (
        <UpgradeButton className="w-full" icon={IconRocket}>
          Upgrade to Pro
        </UpgradeButton>
      )}
    </PlanCard>
  );
}

export function PlanFeatures() {
  return (
    <div className="space-y-2">
      <h3 className="text-[13px] font-medium">Every plan includes</h3>
      <ul className="grid gap-1.5 text-[13px] text-muted-foreground sm:grid-cols-2">
        {PLAN_FEATURES.map((feature) => (
          <li key={feature} className="flex gap-2">
            <IconCheck className="mt-0.5 size-3.5 shrink-0 text-accent-green" aria-hidden />
            {feature}
          </li>
        ))}
      </ul>
    </div>
  );
}

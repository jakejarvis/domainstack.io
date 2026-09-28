import { IconCircleArrowUp, IconRocket } from "@tabler/icons-react";

import { PRO_PRICE_SUMMARY } from "@/components/pro-upgrade-button";
import { useSubscription } from "@/hooks/use-subscription";
import { PLAN_QUOTAS } from "@domainstack/constants";
import { Spinner } from "@domainstack/ui/spinner";

export function GridUpgradeButton() {
  const { handleCheckout, isCheckoutLoading, isPro, isSubscriptionLoading } = useSubscription();

  if (isSubscriptionLoading || isPro) {
    return null;
  }

  return (
    <button
      type="button"
      onClick={handleCheckout}
      disabled={isCheckoutLoading}
      aria-label="Upgrade to Pro"
      aria-busy={isCheckoutLoading}
      className="group flex h-full w-full cursor-pointer flex-col rounded-xl border border-accent-gold/25 bg-background bg-linear-to-bl from-accent-gold/10 to-transparent to-60% text-card-foreground shadow-sm transition-colors hover:border-accent-gold/50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring disabled:cursor-not-allowed disabled:opacity-50"
    >
      <span className="flex h-full flex-1 flex-col items-center gap-6 p-6 text-center">
        <span className="flex h-full flex-1 flex-col items-center justify-center">
          <span className="mb-4 flex size-14 items-center justify-center rounded-xl bg-accent-gold/10 ring-1 ring-accent-gold/20 ring-inset">
            <IconCircleArrowUp className="size-7 text-accent-gold" />
          </span>

          <span className="mb-2 block text-lg font-semibold">Upgrade to Pro</span>

          <span className="mb-4 block text-sm text-muted-foreground">
            Track up to {PLAN_QUOTAS.pro} domains.
          </span>

          <span className="block text-sm text-muted-foreground">{PRO_PRICE_SUMMARY}</span>
        </span>

        <span className="flex h-9 w-full items-center justify-center gap-2 rounded-md border border-border bg-background px-4 py-2 text-sm font-medium transition-colors group-hover:bg-muted group-hover:text-foreground">
          {isCheckoutLoading ? <Spinner /> : <IconRocket className="size-4" />}
          Get Pro
        </span>
      </span>
    </button>
  );
}

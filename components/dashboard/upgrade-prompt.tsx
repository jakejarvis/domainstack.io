import { Gauge, ShoppingCart, XIcon } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Spinner } from "@/components/ui/spinner";
import type { SubscriptionData } from "@/hooks/use-subscription";
import { useUpgradeCheckout } from "@/hooks/use-upgrade-checkout";

type UpgradePromptProps = {
  subscription: SubscriptionData;
};

export function UpgradePrompt({ subscription }: UpgradePromptProps) {
  const [isVisible, setIsVisible] = useState(true);
  const { handleUpgrade, isLoading: isCheckoutLoading } = useUpgradeCheckout();

  const { activeCount, maxDomains } = subscription;

  // Show prompt when at 80% capacity or at limit
  const nearLimit = activeCount >= maxDomains * 0.8;
  const atLimit = activeCount >= maxDomains;

  if (!nearLimit || !isVisible) return null;

  return (
    <Card className="group/upgrade-prompt relative overflow-hidden border-black/10 bg-gradient-to-br from-black/[0.02] to-black/[0.04] dark:border-white/10 dark:from-white/[0.02] dark:to-white/[0.04]">
      {/* Dismiss button */}
      <Button
        variant="ghost"
        size="icon"
        className="absolute top-2 right-2 z-10 size-6 text-muted-foreground hover:text-foreground group-hover/upgrade-prompt:visible sm:invisible"
        onClick={() => setIsVisible(false)}
        aria-label="Dismiss"
      >
        <XIcon />
        <span className="sr-only">Dismiss</span>
      </Button>

      {/* Decorative elements - subtle warm glows */}
      <div
        aria-hidden
        className="pointer-events-none absolute -top-8 -right-8 size-32 rounded-full bg-accent-gold/15 blur-3xl"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -bottom-8 -left-8 size-24 rounded-full bg-accent-gold-muted/20 blur-3xl"
      />

      <CardHeader className="relative flex flex-col items-start justify-between gap-4 space-y-0 md:flex-row md:items-center">
        <div className="flex-1 space-y-1.5">
          <div className="flex items-start gap-5 md:items-center">
            <div className="flex size-10 items-center justify-center rounded-xl bg-accent-gold/5 dark:bg-white/5">
              <Gauge className="size-5 text-accent-gold" />
            </div>
            <div className="space-y-1">
              <CardTitle className="text-lg">
                {atLimit ? "Domain Limit Reached" : "Approaching Limit"}
              </CardTitle>
              <CardDescription>
                {atLimit
                  ? `You've reached your limit of ${maxDomains} tracked domains.`
                  : `You're using ${activeCount} of ${maxDomains} domain slots.`}{" "}
                Upgrade to Pro for more capacity.
              </CardDescription>
            </div>
          </div>
        </div>
        <Button
          onClick={handleUpgrade}
          disabled={isCheckoutLoading}
          className="w-full shrink-0 md:mr-2 md:w-auto"
        >
          {isCheckoutLoading ? (
            <>
              <Spinner />
              Loading...
            </>
          ) : (
            <>
              <ShoppingCart />
              Upgrade
            </>
          )}
        </Button>
      </CardHeader>
    </Card>
  );
}

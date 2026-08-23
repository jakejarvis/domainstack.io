"use client";

import { IconCreditCard, IconLogin, IconShoppingCart } from "@tabler/icons-react";
import { format } from "date-fns";
import Link from "next/link";

import { UpgradeButton } from "@/components/upgrade-button";
import { useSubscription } from "@/hooks/use-subscription";
import { useSession } from "@domainstack/auth/client";
import { Button } from "@domainstack/ui/button";
import { Skeleton } from "@domainstack/ui/skeleton";
import { Spinner } from "@domainstack/ui/spinner";

export function PricingCta() {
  const { data: session, isPending } = useSession();
  const {
    subscription,
    isPro,
    isSubscriptionLoading,
    handleCustomerPortal,
    isCustomerPortalLoading,
  } = useSubscription({ enabled: !!session?.user });

  if (isPending || (session?.user && isSubscriptionLoading)) {
    return <Skeleton className="h-11 w-full" aria-hidden />;
  }

  if (!session?.user) {
    return (
      <Button
        size="lg"
        className="min-h-11 w-full"
        nativeButton={false}
        render={
          <Link href="/login" scroll={false}>
            <IconLogin />
            Sign in to get Pro
          </Link>
        }
      />
    );
  }

  if (isPro) {
    return (
      <div className="space-y-2">
        <p className="text-center text-sm text-muted-foreground">
          You&apos;re on Pro. Thank you for your support.
        </p>
        <Button
          variant="outline"
          size="lg"
          className="min-h-11 w-full"
          onClick={handleCustomerPortal}
          disabled={isCustomerPortalLoading}
        >
          {isCustomerPortalLoading ? <Spinner /> : <IconCreditCard />}
          Manage Subscription
        </Button>
        {subscription?.endsAt && (
          <p className="text-center text-xs text-muted-foreground">
            Your Pro access continues until {format(subscription.endsAt, "MMMM d, yyyy")}
          </p>
        )}
      </div>
    );
  }

  return (
    <UpgradeButton size="lg" className="min-h-11 w-full" icon={IconShoppingCart}>
      Upgrade to Pro
    </UpgradeButton>
  );
}

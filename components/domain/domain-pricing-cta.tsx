"use client";

import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useAnalytics } from "@/lib/analytics/client";
import { PRICING_PROVIDERS } from "@/lib/constants/pricing-providers";
import { useTRPC } from "@/lib/trpc/client";
import { cn } from "@/lib/utils";

export function DomainPricingCTASkeleton({
  className,
}: {
  className?: string;
}) {
  const providerCount = Object.keys(PRICING_PROVIDERS ?? {}).length;

  return (
    <div className={cn("flex flex-col items-center justify-center", className)}>
      <Skeleton className="mt-1 mb-1 h-3 w-20" aria-hidden />
      {Array.from({ length: providerCount }, (_, i) => (
        // biome-ignore lint/suspicious/noArrayIndexKey: Static skeleton elements never reorder
        <Skeleton key={i} className="mt-2 h-8 w-48" aria-hidden />
      ))}
      <Skeleton className="mt-7 mb-1 h-3 w-64" aria-hidden />
    </div>
  );
}

function formatPrice(value: string): string | null {
  const amount = Number.parseFloat(value);
  if (!Number.isFinite(amount)) return null;
  try {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      maximumFractionDigits: 2,
    }).format(amount);
  } catch {
    return `$${amount.toFixed(2)}`;
  }
}

export function DomainPricingCTA({
  domain,
  className,
}: {
  domain: string;
  className?: string;
}) {
  const trpc = useTRPC();
  const analytics = useAnalytics();

  const { data, isLoading } = useQuery(
    trpc.domain.getPricing.queryOptions(
      { domain },
      {
        // Keep in cache indefinitely during session
        staleTime: Number.POSITIVE_INFINITY,
      },
    ),
  );

  if (isLoading) {
    return <DomainPricingCTASkeleton className={className} />;
  }

  const providers = data?.providers ?? [];
  if (providers.length === 0) return null;

  const tldSuffix = domain.split(".").slice(1).join(".");

  const sortedProviders = [...providers].sort((a, b) => {
    const priceA = Number.parseFloat(a.price);
    const priceB = Number.parseFloat(b.price);
    return priceA - priceB;
  });

  return (
    <div className={cn("flex flex-col items-center justify-center", className)}>
      <p className="mb-2 text-[13px] text-muted-foreground">…until now?</p>

      <div className="flex flex-col gap-2">
        {sortedProviders.map((providerPricing) => {
          const config = PRICING_PROVIDERS[providerPricing.provider];
          if (!config) return null;

          const price = formatPrice(providerPricing.price);
          if (!price) return null;

          const Icon = config.icon;

          return (
            <Button
              key={providerPricing.provider}
              variant="outline"
              asChild
              className="w-full min-w-[250px]"
            >
              <a
                href={config.searchUrl(domain)}
                target="_blank"
                rel="noopener"
                aria-label={`Register this domain with ${config.name}`}
                className="flex items-center gap-2"
                onClick={() =>
                  analytics.track("registrar_referral_clicked", {
                    domain,
                    provider: providerPricing.provider,
                  })
                }
              >
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span
                      className={cn(
                        "rounded-full",
                        config.transparentIcon ? "bg-transparent" : "bg-white",
                      )}
                    >
                      <Icon className="size-5" />
                    </span>
                  </TooltipTrigger>
                  <TooltipContent>{config.name}</TooltipContent>
                </Tooltip>

                <span>
                  <span className="text-foreground/85">.{tldSuffix} from</span>{" "}
                  <span className="font-semibold">{price}</span>
                  <span className="text-muted-foreground text-xs">/year</span>
                </span>
              </a>
            </Button>
          );
        })}
      </div>

      <p className="mt-6 text-muted-foreground text-xs">
        These are not affiliate links, but they{" "}
        <a
          href="https://jarv.is/contact"
          target="_blank"
          rel="noopener"
          className="text-foreground/85 underline underline-offset-2 hover:text-foreground/60"
        >
          might be
        </a>{" "}
        in the future!
      </p>
    </div>
  );
}

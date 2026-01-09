import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useAnalytics } from "@/lib/analytics/client";
import { PRICING_PROVIDERS } from "@/lib/constants/pricing-providers";
import { extractTldClient } from "@/lib/domain-utils";
import { useTRPC } from "@/lib/trpc/client";
import { cn } from "@/lib/utils";

function RegistrarLinksSkeleton({ className }: { className?: string }) {
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

export function RegistrarLinks({
  domain,
  className,
}: {
  domain: string;
  className?: string;
}) {
  const trpc = useTRPC();
  const analytics = useAnalytics();

  // Extract TLD from the domain on the client side
  const tld = extractTldClient(domain);

  const { data, isLoading } = useQuery(
    trpc.registrar.getPricing.queryOptions(
      { tld: tld ?? "" },
      {
        // Keep in cache indefinitely during session
        staleTime: Number.POSITIVE_INFINITY,
        // Don't fetch if no TLD
        enabled: !!tld,
      },
    ),
  );

  if (isLoading) {
    return <RegistrarLinksSkeleton className={className} />;
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
              className="flex w-full min-w-[250px] items-center gap-2.5"
              nativeButton={false}
              render={
                <a
                  href={config.searchUrl(domain)}
                  target="_blank"
                  rel="noopener"
                  aria-label={`Register this domain with ${config.name}`}
                  onClick={() =>
                    analytics.track("registrar_referral_clicked", {
                      domain,
                      provider: providerPricing.provider,
                    })
                  }
                >
                  <Tooltip>
                    <TooltipTrigger
                      render={
                        <span className="rounded-full">
                          <Icon className="size-5" />
                        </span>
                      }
                    />
                    <TooltipContent>{config.name}</TooltipContent>
                  </Tooltip>
                  <span>
                    <span className="text-foreground/85">
                      .{tldSuffix} from
                    </span>{" "}
                    <span className="font-semibold">{price}</span>
                    <span className="text-muted-foreground text-xs">/year</span>
                  </span>
                </a>
              }
            />
          );
        })}
      </div>

      <p className="mt-6 text-muted-foreground text-xs">
        These are not affiliate links, but they{" "}
        <Link
          href="/help#contact"
          className="text-foreground/85 underline underline-offset-2 hover:text-foreground/60"
        >
          might be
        </Link>{" "}
        in the future!
      </p>
    </div>
  );
}

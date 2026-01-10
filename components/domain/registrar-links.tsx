import { SiCloudflare } from "@icons-pack/react-simple-icons";
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
import { extractTldClient } from "@/lib/domain-utils";
import { useTRPC } from "@/lib/trpc/client";
import { cn } from "@/lib/utils";

/**
 * Registry of all supported pricing providers.
 * Add new providers here and they'll automatically appear in the CTA.
 */
export const REGISTRAR_PROVIDERS: Record<
  string,
  {
    /** Provider display name */
    name: string;
    /** Generate registration URL for a domain */
    searchUrl: (domain: string) => string;
    /** Provider icon component */
    icon: React.ReactNode;
  }
> = {
  porkbun: {
    name: "Porkbun",
    searchUrl: (domain) => `https://porkbun.com/checkout/search?q=${domain}`,
    icon: (
      <svg viewBox="0 0 24 24" fill="currentColor">
        <circle fill="white" cx="12" cy="12" r="12" />
        <path
          fill="#EF7878"
          d="M12 0A11.97 11.97 0 0 0 .018 11.982C.018 18.612 5.37 24 12 24s11.982-5.353 11.982-11.982C23.982 5.388 18.63 0 12 0M5.832 5.885c1.064.248 2.092.638 3.014 1.135-1.1.531-1.987 1.382-2.66 2.375a3.4 3.4 0 0 1-.674-2.057c0-.532.107-.992.32-1.453m12.336 0c.213.425.32.921.32 1.453 0 .78-.248 1.49-.674 2.057-.673-.993-1.596-1.844-2.66-2.375a10 10 0 0 1 3.014-1.135m-6.072.81a6.39 6.39 0 0 1 6.32 6.457v3.829a1.18 1.18 0 0 1-1.17 1.17 1.18 1.18 0 0 1-1.17-1.17v-.958H7.852v.957a1.18 1.18 0 0 1-1.17 1.17 1.18 1.18 0 0 1-1.17-1.17v-3.65c0-3.51 2.73-6.489 6.24-6.63q.173-.007.344-.005m1.5 3.8a.94.94 0 0 0-.922.921c0 .248.07.424.213.602.141.212.353.354.566.46-.142.071-.319.143-.496.143-.213 0-.39.176-.39.389s.177.39.39.39h.178a1.56 1.56 0 0 0 1.383-.851c.39-.142.709-.39.921-.744.071-.107.034-.249-.037-.213-.106-.036-.212-.034-.283.072a1.04 1.04 0 0 1-.426.354v-.143c0-.39-.14-.709-.353-.992a.88.88 0 0 0-.744-.389m0 .53c.212 0 .353.141.388.354v.178c0 .177-.034.354-.105.496a1.06 1.06 0 0 1-.604-.426c-.035-.071-.07-.14-.07-.211 0-.24.206-.39.39-.39"
        />
      </svg>
    ),
  },
  cloudflare: {
    name: "Cloudflare Registrar",
    searchUrl: (domain) => `https://domains.cloudflare.com/?domain=${domain}`,
    icon: <SiCloudflare fill="#F38020" />,
  },
  dynadot: {
    name: "Dynadot",
    searchUrl: (domain) =>
      `https://www.dynadot.com/domain/search?domain=${domain}`,
    icon: (
      <svg viewBox="0 0 24 24" fill="#1FA7FF">
        <path d="M19.688 5.66c-1.218-2.439-4.29-3.355-6.708-2.098L5.82 7.286l1.605 3.081-1.618.84c-2.395 1.245-3.412 4.262-2.15 6.649a4.88 4.88 0 0 0 6.552 2.044l7.258-3.776-1.6-3.078 1.71-.89a4.877 4.877 0 0 0 2.111-6.494zM9.376 18.293a3.07 3.07 0 0 1-4.419-2.107 2.7 2.7 0 0 1-.059-.757c.073-1.13.697-2.076 1.653-2.57l1.708-.89.707 1.36a2.936 2.936 0 0 0 3.955 1.25l1.343-.698.767 1.475-5.653 2.938zm2.542-7.961c.551.105.995.548 1.101 1.098a1.403 1.403 0 0 1-1.648 1.65 1.4 1.4 0 0 1-1.101-1.102 1.403 1.403 0 0 1 1.648-1.648zm4.75.256-1.635.852-.707-1.358a2.934 2.934 0 0 0-3.955-1.25l-1.344.699-.768-1.476 5.654-2.938a3.07 3.07 0 0 1 4.107 1.258c.814 1.506.167 3.424-1.353 4.215z" />
      </svg>
    ),
  },
} as const;

function RegistrarLinksSkeleton({ className }: { className?: string }) {
  const providerCount = Object.keys(REGISTRAR_PROVIDERS ?? {}).length;

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
          const config = REGISTRAR_PROVIDERS[providerPricing.provider];
          if (!config) return null;

          const price = formatPrice(providerPricing.price);
          if (!price) return null;

          return (
            <Button
              key={providerPricing.provider}
              variant="outline"
              className="[&_svg]:!size-5 [&_svg]:!shrink-0 flex w-full min-w-[250px] items-center gap-2.5"
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
                        <span className="rounded-full">{config.icon}</span>
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

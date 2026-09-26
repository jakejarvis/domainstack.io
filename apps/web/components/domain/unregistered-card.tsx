import { catchError } from "next/error";
import Link from "next/link";
import { Suspense } from "react";

import { RegistrarLinks, RegistrarLinksSkeleton } from "@/components/domain/registrar-links";
import { Card } from "@domainstack/ui/card";

// Renders nothing on error; used for supplementary info like pricing.
const SilentErrorBoundary = catchError(() => null);

interface DomainUnregisteredCardProps {
  /** The unregistered registrable domain. */
  domain: string;
  /**
   * The subdomain the report was requested for, when it isn't `domain` itself.
   * It can't be registered on its own, so the card explains its parent instead.
   */
  hostname?: string;
  /** TLD to show registrar pricing for; null when the TLD isn't publicly registrable. */
  pricingTld: string | null;
}

export function DomainUnregisteredCard({
  domain,
  hostname,
  pricingTld,
}: DomainUnregisteredCardProps) {
  return (
    <Card className="relative overflow-hidden px-6 text-center">
      <div
        aria-hidden
        className="pointer-events-none absolute -inset-x-35 -top-35 h-85 glow-accent-indigo/15"
      />

      <div className="relative space-y-4.5">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight break-words sm:text-3xl">
            {domain}
          </h2>
          <p className="mt-2 text-sm text-muted-foreground sm:text-base">
            appears to be unregistered…
          </p>
        </div>

        {hostname && (
          <p className="mx-auto max-w-prose text-sm text-balance break-words text-muted-foreground">
            <span className="font-medium text-foreground">{hostname}</span> cannot exist in public
            DNS until its registered domain exists.{" "}
            <Link
              href={`/${encodeURIComponent(domain)}`}
              className="text-foreground underline underline-offset-2"
            >
              View {domain}
            </Link>
          </p>
        )}

        {pricingTld && (
          // Silently fail on pricing errors - this is supplementary info
          <SilentErrorBoundary>
            <Suspense fallback={<RegistrarLinksSkeleton />}>
              <RegistrarLinks domain={domain} tld={pricingTld} />
            </Suspense>
          </SilentErrorBoundary>
        )}
      </div>
    </Card>
  );
}

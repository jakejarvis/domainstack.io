"use client";

import { catchError } from "next/error";
import { Suspense } from "react";

import { RegistrarLinks, RegistrarLinksSkeleton } from "@/components/domain/registrar-links";
import { NONPUBLIC_TLDS } from "@domainstack/constants";
import { extractTldClient } from "@domainstack/utils/domain/client";

// Renders nothing on error; used for supplementary info like pricing.
const SilentErrorBoundary = catchError(() => null);

interface DomainUnregisteredCardProps {
  domain: string;
}

export function DomainUnregisteredCard({ domain }: DomainUnregisteredCardProps) {
  const lower = (domain ?? "").toLowerCase();
  const isNonPublicTld = NONPUBLIC_TLDS.some((suffix) => lower.endsWith(suffix));

  // Extract TLD for registrar pricing - parent handles validation
  const tld = extractTldClient(domain);
  const canShowRegistrarLinks = !isNonPublicTld && tld;

  return (
    <div className="relative overflow-hidden rounded-xl border bg-card p-8 text-center shadow-sm">
      <div
        aria-hidden
        className="pointer-events-none absolute -inset-x-35 -top-35 h-85 glow-accent-indigo/20"
      />

      <div className="space-y-4.5">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight sm:text-3xl">{domain}</h2>

          <p className="mt-2 text-sm text-muted-foreground sm:text-base">
            appears to be unregistered…
          </p>
        </div>

        {canShowRegistrarLinks && (
          // Silently fail on pricing errors - this is supplementary info
          <SilentErrorBoundary>
            <Suspense fallback={<RegistrarLinksSkeleton />}>
              <RegistrarLinks domain={domain} tld={tld} />
            </Suspense>
          </SilentErrorBoundary>
        )}
      </div>
    </div>
  );
}

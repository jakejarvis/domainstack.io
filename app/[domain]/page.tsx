import { dehydrate, HydrationBoundary } from "@tanstack/react-query";
import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { DomainReportView } from "@/components/domain/domain-report-view";
import { normalizeDomainInput } from "@/lib/domain";
import { toRegistrableDomain } from "@/lib/domain-server";
import { makeQueryClient } from "@/trpc/query-client";
import { trpc } from "@/trpc/server";

import "country-flag-icons/3x2/flags.css";
import "mapbox-gl/dist/mapbox-gl.css";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ domain: string }>;
}): Promise<Metadata> {
  const { domain: raw } = await params;
  const decoded = decodeURIComponent(raw);
  const normalized = normalizeDomainInput(decoded);

  return {
    title: `${normalized} — Domain Report`,
    description: `Investigate ${normalized}'s WHOIS, DNS, SSL, headers, and more.`,
    alternates: {
      canonical: `/${normalized}`,
    },
  };
}

export default async function DomainPage({
  params,
}: {
  params: Promise<{ domain: string }>;
}) {
  const { domain: raw } = await params;
  const decoded = decodeURIComponent(raw);
  const normalized = normalizeDomainInput(decoded);

  const isRegistrable = toRegistrableDomain(normalized);
  if (!isRegistrable) notFound();

  // Canonicalize URL to the normalized domain (middleware should already handle most cases)
  if (normalized !== decoded) {
    redirect(`/${encodeURIComponent(normalized)}`);
  }

  // Minimal prefetch: registration only, let sections stream progressively
  const queryClient = makeQueryClient();
  queryClient.prefetchQuery(
    trpc.domain.registration.queryOptions({ domain: normalized }),
  );

  return (
    <div className="container mx-auto max-w-4xl px-4 py-6">
      <HydrationBoundary state={dehydrate(queryClient)}>
        <DomainReportView domain={normalized} />
      </HydrationBoundary>
    </div>
  );
}

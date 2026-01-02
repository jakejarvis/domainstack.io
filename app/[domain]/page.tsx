import { dehydrate, HydrationBoundary } from "@tanstack/react-query";
import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { DomainReportClient } from "@/components/domain/report-client";
import { analytics } from "@/lib/analytics/server";
import { toRegistrableDomain } from "@/lib/domain-server";
import { getQueryClient, trpc } from "@/trpc/server";

import "country-flag-icons/3x2/flags.css";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ domain: string }>;
}): Promise<Metadata> {
  const { domain: raw } = await params;
  const decoded = decodeURIComponent(raw);

  const registrable = toRegistrableDomain(decoded);
  if (!registrable) {
    // workaround, should match metadata from not-found.tsx
    return {
      title: "Not Found",
      description: "The page you're looking for doesn't exist.",
    };
  }

  return {
    title: {
      absolute: `${registrable} — Domain Report`,
    },
    description: `Domainstack report for ${registrable}: WHOIS lookup, DNS & SSL scan, HTTP headers, hosting & email provider data, and SEO metadata.`,
    alternates: {
      canonical: `/${registrable}`,
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

  const registrable = toRegistrableDomain(decoded);
  if (!registrable) notFound();

  // Canonicalize URL to the registrable domain (middleware should already handle most cases)
  if (registrable !== decoded) {
    redirect(`/${encodeURIComponent(registrable)}`);
  }

  // Track server-side page view
  analytics.track("report_viewed", { domain: registrable });

  // Parallel prefetch: start all queries simultaneously (fire-and-forget)
  // This eliminates waterfall while allowing the page to stream immediately
  // Use getQueryClient() to ensure consistent query client across the request
  const queryClient = getQueryClient();
  void Promise.all([
    queryClient.prefetchQuery(
      trpc.domain.getRegistration.queryOptions({ domain: registrable }),
    ),
    queryClient.prefetchQuery(
      trpc.domain.getHosting.queryOptions({ domain: registrable }),
    ),
    queryClient.prefetchQuery(
      trpc.domain.getDnsRecords.queryOptions({ domain: registrable }),
    ),
    queryClient.prefetchQuery(
      trpc.domain.getCertificates.queryOptions({ domain: registrable }),
    ),
    queryClient.prefetchQuery(
      trpc.domain.getHeaders.queryOptions({ domain: registrable }),
    ),
    queryClient.prefetchQuery(
      trpc.domain.getSeo.queryOptions({ domain: registrable }),
    ),
  ]);

  return (
    <div className="container mx-auto max-w-4xl px-4 py-6">
      <HydrationBoundary state={dehydrate(queryClient)}>
        <DomainReportClient domain={registrable} />
      </HydrationBoundary>
    </div>
  );
}

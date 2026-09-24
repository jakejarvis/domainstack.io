import { noop } from "@tanstack/react-query";
import type { Metadata } from "next";
import { io } from "next/cache";
import { notFound, redirect } from "next/navigation";
import { Suspense } from "react";

import { DomainReportClient } from "@/components/domain/report-client";
import { DomainReportSkeleton } from "@/components/domain/report-skeleton";
import { OG_IMAGE_SIZE } from "@/lib/og-utils";
import { safeDecodeURIComponent } from "@/lib/safe-parse";
import { createMetadata, notFoundMetadata } from "@/lib/seo";
import { getQueryClient, HydrateClient, trpc } from "@/trpc/server";
import { NONPUBLIC_TLDS } from "@domainstack/constants";
import { toRegistrableDomain } from "@domainstack/utils/domain";
import { extractTldClient } from "@domainstack/utils/domain/client";

export async function generateMetadata({ params }: PageProps<"/[domain]">): Promise<Metadata> {
  const { domain: raw } = await params;
  // Route params arrive decoded; a malformed escape like `/%25` would make a
  // second bare decode throw, so fall back to the raw segment and let
  // `toRegistrableDomain` reject it.
  const decoded = safeDecodeURIComponent(raw) ?? raw;

  const registrable = toRegistrableDomain(decoded);
  if (!registrable) {
    return notFoundMetadata;
  }

  const imageUrl = `/api/og?domain=${encodeURIComponent(registrable)}`;

  return createMetadata({
    path: `/${registrable}`,
    title: {
      absolute: `${registrable} — Domain Report`,
    },
    description: `Domainstack report for ${registrable}: WHOIS lookup, DNS & SSL scan, HTTP headers, hosting & email provider data, and SEO metadata.`,
    openGraph: {
      images: [
        {
          url: imageUrl,
          width: OG_IMAGE_SIZE.width,
          height: OG_IMAGE_SIZE.height,
          alt: `Domainstack — Domain Report for ${registrable}`,
        },
      ],
    },
    twitter: {
      images: [imageUrl],
    },
  });
}

async function DomainReport({ params }: Pick<PageProps<"/[domain]">, "params">) {
  await io();

  const { domain: raw } = await params;
  // Decoded defensively for the same reason as in `generateMetadata` above.
  const decoded = safeDecodeURIComponent(raw) ?? raw;

  const registrable = toRegistrableDomain(decoded);
  if (!registrable) notFound();

  // Canonicalize URL to the registrable domain (middleware should already handle most cases)
  if (registrable !== decoded) {
    redirect(`/${encodeURIComponent(registrable)}`);
  }

  // Registrar pricing is only offered for publicly registrable TLDs.
  const pricingTld = NONPUBLIC_TLDS.some((suffix) => registrable.endsWith(suffix))
    ? null
    : extractTldClient(registrable);

  const queryClient = getQueryClient();
  const registration = await queryClient
    .query(trpc.domain.getRegistration.queryOptions({ domain: registrable }))
    .catch(noop);

  // Start the follow-up lookups here without awaiting them: the pending queries
  // are dehydrated and stream to the client, so the client components' suspense
  // queries attach to these promises instead of issuing their own tRPC requests
  // (which during SSR would loop back to this deployment over HTTP).
  if (registration?.success) {
    if (registration.data.isRegistered) {
      const input = { domain: registrable };
      void queryClient.query(trpc.domain.getHosting.queryOptions(input)).catch(noop);
      void queryClient.query(trpc.domain.getDnsRecords.queryOptions(input)).catch(noop);
      void queryClient.query(trpc.domain.getCertificates.queryOptions(input)).catch(noop);
      void queryClient.query(trpc.domain.getHeaders.queryOptions(input)).catch(noop);
      void queryClient.query(trpc.domain.getSeo.queryOptions(input)).catch(noop);
    } else if (pricingTld) {
      void queryClient
        .query(trpc.registrar.getPricing.queryOptions({ tld: pricingTld }))
        .catch(noop);
    }
  }

  return (
    <HydrateClient>
      <DomainReportClient domain={registrable} pricingTld={pricingTld} />
    </HydrateClient>
  );
}

export default function DomainPage({ params }: PageProps<"/[domain]">) {
  return (
    <Suspense fallback={<DomainReportSkeleton />}>
      <DomainReport params={params} />
    </Suspense>
  );
}

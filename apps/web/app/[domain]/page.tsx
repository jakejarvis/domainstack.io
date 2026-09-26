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
import { parseDomainTarget } from "@domainstack/utils/domain";
import { extractTldClient } from "@domainstack/utils/domain/client";

export async function generateMetadata({ params }: PageProps<"/[domain]">): Promise<Metadata> {
  const { domain: raw } = await params;
  // Route params arrive decoded; a malformed escape like `/%25` would make a
  // second bare decode throw, so fall back to the raw segment and let
  // `parseDomainTarget` reject it.
  const decoded = safeDecodeURIComponent(raw) ?? raw;

  const target = parseDomainTarget(decoded);
  if (!target) {
    return notFoundMetadata;
  }
  const { hostname } = target;

  const imageUrl = `/api/og?domain=${encodeURIComponent(hostname)}`;

  return createMetadata({
    path: `/${hostname}`,
    title: {
      absolute: `${hostname} — Domain Report`,
    },
    description: `Domainstack report for ${hostname}: WHOIS lookup, DNS & SSL scan, HTTP headers, hosting & email provider data, and SEO metadata.`,
    openGraph: {
      images: [
        {
          url: imageUrl,
          width: OG_IMAGE_SIZE.width,
          height: OG_IMAGE_SIZE.height,
          alt: `Domainstack — Domain Report for ${hostname}`,
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

  const target = parseDomainTarget(decoded);
  if (!target) notFound();
  const { hostname, registrableDomain, isSubdomain } = target;

  // Canonicalize formatting only (case, punycode, trailing dot); every label of
  // the hostname is kept. The proxy should already handle most cases.
  if (hostname !== decoded) {
    redirect(`/${encodeURIComponent(hostname)}`);
  }

  // Registrar pricing is only offered for a publicly registrable domain itself,
  // never for a subdomain of one.
  const pricingTld =
    isSubdomain || NONPUBLIC_TLDS.some((suffix) => registrableDomain.endsWith(suffix))
      ? null
      : extractTldClient(registrableDomain);

  const queryClient = getQueryClient();

  // Start the hostname-scoped lookups first, without awaiting them, so a slow
  // RDAP/WHOIS lookup never delays them: the pending queries are dehydrated and
  // stream to the client, so the client components' suspense queries attach to
  // these promises instead of issuing their own tRPC requests (which during SSR
  // would loop back to this deployment over HTTP).
  const input = { domain: hostname };
  void queryClient.query(trpc.domain.getHosting.queryOptions(input)).catch(noop);
  void queryClient.query(trpc.domain.getDnsRecords.queryOptions(input)).catch(noop);
  void queryClient.query(trpc.domain.getCertificates.queryOptions(input)).catch(noop);
  void queryClient.query(trpc.domain.getHeaders.queryOptions(input)).catch(noop);
  void queryClient.query(trpc.domain.getSeo.queryOptions(input)).catch(noop);

  // Registration is awaited so the unregistered state renders without a flash.
  // A failure here is a registration-section failure, not a report failure.
  const registration = await queryClient
    .query(trpc.domain.getRegistration.queryOptions({ domain: registrableDomain }))
    .catch(noop);

  if (registration?.success && !registration.data.isRegistered && pricingTld) {
    void queryClient.query(trpc.registrar.getPricing.queryOptions({ tld: pricingTld })).catch(noop);
  }

  return (
    <HydrateClient>
      <DomainReportClient
        hostname={hostname}
        registrableDomain={registrableDomain}
        pricingTld={pricingTld}
      />
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

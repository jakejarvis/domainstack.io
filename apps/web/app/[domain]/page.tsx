import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";

import { DomainReportClient } from "@/components/domain/report-client";
import { toRegistrableDomain } from "@/lib/normalize-domain";
import { OG_IMAGE_SIZE } from "@/lib/og-utils";
import { createMetadata, notFoundMetadata } from "@/lib/seo";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ domain: string }>;
}): Promise<Metadata> {
  const { domain: raw } = await params;
  const decoded = decodeURIComponent(raw);

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

export default async function DomainPage({ params }: { params: Promise<{ domain: string }> }) {
  const { domain: raw } = await params;
  const decoded = decodeURIComponent(raw);

  const registrable = toRegistrableDomain(decoded);
  if (!registrable) notFound();

  // Canonicalize URL to the registrable domain (middleware should already handle most cases)
  if (registrable !== decoded) {
    redirect(`/${encodeURIComponent(registrable)}`);
  }

  return <DomainReportClient domain={registrable} />;
}

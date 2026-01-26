import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { DomainReportClient } from "@/components/domain/report-client";
import { analytics } from "@/lib/analytics/server";
import { toRegistrableDomain } from "@/lib/normalize-domain";

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
    openGraph: {
      title: `${registrable} — Domain Report`,
      description: `Domainstack report for ${registrable}: WHOIS lookup, DNS & SSL scan, HTTP headers, hosting & email provider data, and SEO metadata.`,
      images: [
        {
          url: `/api/og?domain=${encodeURIComponent(registrable)}`,
          width: 1200,
          height: 630,
          alt: `Domainstack — Domain Report for ${registrable}`,
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title: `${registrable} — Domain Report`,
      description: `Domainstack report for ${registrable}: WHOIS lookup, DNS & SSL scan, HTTP headers, hosting & email provider data, and SEO metadata.`,
      images: [`/api/og?domain=${encodeURIComponent(registrable)}`],
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

  return <DomainReportClient domain={registrable} />;
}

"use client";

import { useQuery, useSuspenseQuery } from "@tanstack/react-query";
import { Suspense, useRef } from "react";
import { CertificatesSection } from "@/components/domain/certificates/certificates-section";
import { CertificatesSectionSkeleton } from "@/components/domain/certificates/certificates-section-skeleton";
import { DnsSection } from "@/components/domain/dns/dns-section";
import { DnsSectionSkeleton } from "@/components/domain/dns/dns-section-skeleton";
import { HeadersSection } from "@/components/domain/headers/headers-section";
import { HeadersSectionSkeleton } from "@/components/domain/headers/headers-section-skeleton";
import { HostingSection } from "@/components/domain/hosting/hosting-section";
import { HostingSectionSkeleton } from "@/components/domain/hosting/hosting-section-skeleton";
import { RegistrationSection } from "@/components/domain/registration/registration-section";
import { RegistrationSectionSkeleton } from "@/components/domain/registration/registration-section-skeleton";
import { DomainReportHeader } from "@/components/domain/report-header";
import { SectionNav } from "@/components/domain/report-nav";
import { SectionErrorBoundary } from "@/components/domain/report-section-error-boundary";
import { SectionFailedAlert } from "@/components/domain/section-failed-alert";
import { SeoSection } from "@/components/domain/seo/seo-section";
import { SeoSectionSkeleton } from "@/components/domain/seo/seo-section-skeleton";
import { DomainUnregisteredCard } from "@/components/domain/unregistered-card";
import { useDomainHistory } from "@/hooks/use-domain-history";
import { useReportSectionObserver } from "@/hooks/use-report-section-observer";
import { sections } from "@/lib/constants/sections";
import { useTRPC } from "@/lib/trpc/client";

function AllSkeletonsExceptRegistration() {
  return (
    <>
      <HostingSectionSkeleton />
      <DnsSectionSkeleton />
      <CertificatesSectionSkeleton />
      <HeadersSectionSkeleton />
      <SeoSectionSkeleton />
    </>
  );
}

/**
 * Query options to disable automatic refetching and retries.
 * Report data is fetched once on page load and doesn't need continuous revalidation.
 * Retries are disabled so errors surface immediately to the error boundary.
 */
const staticQueryOptions = {
  staleTime: Number.POSITIVE_INFINITY,
  retry: false,
  refetchOnMount: false,
  refetchOnWindowFocus: false,
  refetchOnReconnect: false,
} as const;

/**
 * Individual section components that fetch their own data.
 * Each is wrapped in its own Suspense + ErrorBoundary for independent loading/error states.
 */

function SuspendedHostingSection({ domain }: { domain: string }) {
  const trpc = useTRPC();
  const { data } = useSuspenseQuery({
    ...trpc.domain.getHosting.queryOptions({ domain }),
    ...staticQueryOptions,
  });

  if (!data.success) {
    return <SectionFailedAlert section={sections.hosting} error={data.error} />;
  }
  return <HostingSection domain={domain} data={data.data} />;
}

function SuspendedDnsSection({ domain }: { domain: string }) {
  const trpc = useTRPC();
  const { data } = useSuspenseQuery({
    ...trpc.domain.getDnsRecords.queryOptions({ domain }),
    ...staticQueryOptions,
  });

  if (!data.success) {
    return <SectionFailedAlert section={sections.dns} error={data.error} />;
  }
  return <DnsSection domain={domain} data={data.data} />;
}

function SuspendedCertificatesSection({ domain }: { domain: string }) {
  const trpc = useTRPC();
  const { data } = useSuspenseQuery({
    ...trpc.domain.getCertificates.queryOptions({ domain }),
    ...staticQueryOptions,
  });

  if (!data.success) {
    return (
      <SectionFailedAlert section={sections.certificates} error={data.error} />
    );
  }
  return <CertificatesSection domain={domain} data={data.data} />;
}

function SuspendedHeadersSection({ domain }: { domain: string }) {
  const trpc = useTRPC();
  const { data } = useSuspenseQuery({
    ...trpc.domain.getHeaders.queryOptions({ domain }),
    ...staticQueryOptions,
  });

  if (!data.success) {
    return <SectionFailedAlert section={sections.headers} error={data.error} />;
  }
  return <HeadersSection domain={domain} data={data.data} />;
}

function SuspendedSeoSection({ domain }: { domain: string }) {
  const trpc = useTRPC();
  const { data } = useSuspenseQuery({
    ...trpc.domain.getSeo.queryOptions({ domain }),
    ...staticQueryOptions,
  });

  if (!data.success) {
    return <SectionFailedAlert section={sections.seo} error={data.error} />;
  }
  return <SeoSection domain={domain} data={data.data} />;
}

/**
 * Main client component for domain reports.
 * Header and nav render immediately with the domain name.
 * Content area loads progressively with individual section suspense boundaries.
 *
 * Once we confirm a domain is unregistered, header/nav are hidden and only
 * the unregistered card is shown.
 */
export function DomainReportClient({ domain }: { domain: string }) {
  const trpc = useTRPC();

  const { data: registration, isLoading: isRegistrationLoading } = useQuery({
    ...trpc.domain.getRegistration.queryOptions({ domain }),
    ...staticQueryOptions,
  });
  const domainId = registration?.data?.domainId;
  const isRegistered = registration?.data?.isRegistered === true;

  // Section navigation - tracks active section and header visibility for context injection
  const headerRef = useRef<HTMLDivElement>(null);
  const { activeSection, isHeaderVisible, scrollToSection } =
    useReportSectionObserver({
      sectionIds: Object.keys(sections),
      headerRef,
    });

  // Add to search history for registered domains
  useDomainHistory(domain, {
    enabled: isRegistered,
  });

  // For confirmed unregistered domains, show only the unregistered card
  if (!isRegistrationLoading && !isRegistered) {
    return <DomainUnregisteredCard domain={domain} />;
  }

  return (
    <div>
      {/* Page header - renders immediately with domain name */}
      <DomainReportHeader
        domain={domain}
        domainId={domainId}
        isRegistered={isRegistered}
        ref={headerRef}
      />

      {/* Sticky section nav - renders immediately */}
      <SectionNav
        domain={domain}
        sections={Object.values(sections)}
        activeSection={activeSection}
        isHeaderVisible={isHeaderVisible}
        onSectionClick={scrollToSection}
      />

      {/* Content area - each section independently fetches data within its own error boundary */}
      <div className="space-y-4">
        {isRegistrationLoading ? (
          <RegistrationSectionSkeleton />
        ) : (
          <RegistrationSection domain={domain} data={registration?.data} />
        )}

        {/* Show skeletons until we confirm domain is registered */}
        {!isRegistered ? (
          <AllSkeletonsExceptRegistration />
        ) : (
          <>
            <SectionErrorBoundary sectionName="Hosting">
              <Suspense fallback={<HostingSectionSkeleton />}>
                <SuspendedHostingSection domain={domain} />
              </Suspense>
            </SectionErrorBoundary>

            <SectionErrorBoundary sectionName="DNS">
              <Suspense fallback={<DnsSectionSkeleton />}>
                <SuspendedDnsSection domain={domain} />
              </Suspense>
            </SectionErrorBoundary>

            <SectionErrorBoundary sectionName="Certificates">
              <Suspense fallback={<CertificatesSectionSkeleton />}>
                <SuspendedCertificatesSection domain={domain} />
              </Suspense>
            </SectionErrorBoundary>

            <SectionErrorBoundary sectionName="Headers">
              <Suspense fallback={<HeadersSectionSkeleton />}>
                <SuspendedHeadersSection domain={domain} />
              </Suspense>
            </SectionErrorBoundary>

            <SectionErrorBoundary sectionName="SEO">
              <Suspense fallback={<SeoSectionSkeleton />}>
                <SuspendedSeoSection domain={domain} />
              </Suspense>
            </SectionErrorBoundary>
          </>
        )}
      </div>
    </div>
  );
}

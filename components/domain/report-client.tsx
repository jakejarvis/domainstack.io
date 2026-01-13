"use client";

import { useQuery, useSuspenseQueries } from "@tanstack/react-query";
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

function SuspendedSections({
  domain,
  isRegistered,
}: {
  domain: string;
  isRegistered: boolean;
}) {
  const trpc = useTRPC();
  const [hosting, dns, certificates, headers, seo] = useSuspenseQueries({
    queries: [
      trpc.domain.getHosting.queryOptions({ domain }),
      trpc.domain.getDnsRecords.queryOptions({ domain }),
      trpc.domain.getCertificates.queryOptions({ domain }),
      trpc.domain.getHeaders.queryOptions({ domain }),
      trpc.domain.getSeo.queryOptions({ domain }),
    ],
  });

  if (!isRegistered) {
    return <AllSkeletonsExceptRegistration />;
  }

  return (
    <>
      <SectionErrorBoundary sectionName="Hosting">
        <Suspense fallback={<HostingSectionSkeleton />}>
          <HostingSection domain={domain} data={hosting.data.data} />
        </Suspense>
      </SectionErrorBoundary>
      <SectionErrorBoundary sectionName="DNS">
        <Suspense fallback={<DnsSectionSkeleton />}>
          <DnsSection domain={domain} data={dns.data.data} />
        </Suspense>
      </SectionErrorBoundary>
      <SectionErrorBoundary sectionName="Certificates">
        <Suspense fallback={<CertificatesSectionSkeleton />}>
          <CertificatesSection domain={domain} data={certificates.data.data} />
        </Suspense>
      </SectionErrorBoundary>
      <SectionErrorBoundary sectionName="Headers">
        <Suspense fallback={<HeadersSectionSkeleton />}>
          <HeadersSection domain={domain} data={headers.data.data} />
        </Suspense>
      </SectionErrorBoundary>
      <SectionErrorBoundary sectionName="SEO">
        <Suspense fallback={<SeoSectionSkeleton />}>
          <SeoSection domain={domain} data={seo.data.data} />
        </Suspense>
      </SectionErrorBoundary>
    </>
  );
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

  const { data: registration, isLoading: isRegistrationLoading } = useQuery(
    trpc.domain.getRegistration.queryOptions({ domain }),
  );
  const domainId = registration?.data?.domainId;

  // Section navigation - tracks active section and header visibility for context injection
  const headerRef = useRef<HTMLDivElement>(null);
  const { activeSection, isHeaderVisible, scrollToSection } =
    useReportSectionObserver({
      sectionIds: Object.keys(sections),
      headerRef,
    });

  // Add to search history for registered domains
  useDomainHistory(domain, {
    enabled: registration?.data?.isRegistered === true,
  });

  // For confirmed unregistered domains, show only the unregistered card
  if (!isRegistrationLoading && !registration?.data?.isRegistered) {
    return <DomainUnregisteredCard domain={domain} />;
  }

  return (
    <div>
      {/* Page header - renders immediately with domain name */}
      <DomainReportHeader
        domain={domain}
        domainId={domainId}
        isRegistered={registration?.data?.isRegistered}
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

      {/* Content area - individual sections have their own Suspense boundaries BUT we still need a boundary here for the header to render immediately */}
      <div className="space-y-4">
        {isRegistrationLoading ? (
          <RegistrationSectionSkeleton />
        ) : (
          <RegistrationSection domain={domain} data={registration?.data} />
        )}

        <Suspense fallback={<AllSkeletonsExceptRegistration />}>
          <SuspendedSections
            domain={domain}
            isRegistered={registration?.data?.isRegistered === true}
          />
        </Suspense>
      </div>
    </div>
  );
}

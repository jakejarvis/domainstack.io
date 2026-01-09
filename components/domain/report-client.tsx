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
import { SectionErrorBoundary } from "@/components/domain/report-section-error-boundary";
import { SectionsSkeleton } from "@/components/domain/report-skeleton";
import { SectionNav } from "@/components/domain/section-nav";
import { SeoSection } from "@/components/domain/seo/seo-section";
import { SeoSectionSkeleton } from "@/components/domain/seo/seo-section-skeleton";
import { DomainUnregisteredCard } from "@/components/domain/unregistered-card";
import { useDomainHistory } from "@/hooks/use-domain-history";
import { useReportExport } from "@/hooks/use-report-export";
import { useReportSectionObserver } from "@/hooks/use-report-section-observer";
import { sections } from "@/lib/constants/sections";
import { useTRPC } from "@/lib/trpc/client";

// Section content components that fetch and render data
function RegistrationSectionContent({ domain }: { domain: string }) {
  const trpc = useTRPC();
  const { data } = useSuspenseQuery(
    trpc.domain.getRegistration.queryOptions({ domain }),
  );
  return <RegistrationSection domain={domain} data={data.data} />;
}

function HostingSectionContent({ domain }: { domain: string }) {
  const trpc = useTRPC();
  const { data } = useSuspenseQuery(
    trpc.domain.getHosting.queryOptions({ domain }),
  );
  return <HostingSection domain={domain} data={data.data} />;
}

function DnsSectionContent({ domain }: { domain: string }) {
  const trpc = useTRPC();
  const { data } = useSuspenseQuery(
    trpc.domain.getDnsRecords.queryOptions({ domain }),
  );
  return <DnsSection domain={domain} data={data.data} />;
}

function CertificatesSectionContent({ domain }: { domain: string }) {
  const trpc = useTRPC();
  const { data } = useSuspenseQuery(
    trpc.domain.getCertificates.queryOptions({ domain }),
  );
  return <CertificatesSection domain={domain} data={data.data} />;
}

function HeadersSectionContent({ domain }: { domain: string }) {
  const trpc = useTRPC();
  const { data } = useSuspenseQuery(
    trpc.domain.getHeaders.queryOptions({ domain }),
  );
  return <HeadersSection domain={domain} data={data.data} />;
}

function SeoSectionContent({ domain }: { domain: string }) {
  const trpc = useTRPC();
  const { data } = useSuspenseQuery(
    trpc.domain.getSeo.queryOptions({ domain }),
  );
  return <SeoSection domain={domain} data={data.data} />;
}

/**
 * All report sections wrapped in individual suspense boundaries.
 * Renders independently of the header/nav for progressive loading.
 */
function ReportSections({ domain }: { domain: string }) {
  return (
    <div className="space-y-4">
      <SectionErrorBoundary sectionName="Registration">
        <Suspense fallback={<RegistrationSectionSkeleton />}>
          <RegistrationSectionContent domain={domain} />
        </Suspense>
      </SectionErrorBoundary>

      <SectionErrorBoundary sectionName="Hosting">
        <Suspense fallback={<HostingSectionSkeleton />}>
          <HostingSectionContent domain={domain} />
        </Suspense>
      </SectionErrorBoundary>

      <SectionErrorBoundary sectionName="DNS">
        <Suspense fallback={<DnsSectionSkeleton />}>
          <DnsSectionContent domain={domain} />
        </Suspense>
      </SectionErrorBoundary>

      <SectionErrorBoundary sectionName="Certificates">
        <Suspense fallback={<CertificatesSectionSkeleton />}>
          <CertificatesSectionContent domain={domain} />
        </Suspense>
      </SectionErrorBoundary>

      <SectionErrorBoundary sectionName="Headers">
        <Suspense fallback={<HeadersSectionSkeleton />}>
          <HeadersSectionContent domain={domain} />
        </Suspense>
      </SectionErrorBoundary>

      <SectionErrorBoundary sectionName="SEO">
        <Suspense fallback={<SeoSectionSkeleton />}>
          <SeoSectionContent domain={domain} />
        </Suspense>
      </SectionErrorBoundary>
    </div>
  );
}

/**
 * Report content area wrapped in Suspense.
 * The parent component handles the unregistered case, so this just renders sections.
 * We still need to wait for registration to resolve before showing sections
 * (to avoid flashing sections that will be replaced by unregistered card).
 */
function ReportContent({ domain }: { domain: string }) {
  const trpc = useTRPC();
  // Wait for registration to resolve - parent will switch to unregistered card if needed
  const { data: registration } = useSuspenseQuery(
    trpc.domain.getRegistration.queryOptions({ domain }),
  );

  // Add to search history (only for registered domains)
  const isConfirmedUnregistered =
    registration.data?.isRegistered === false &&
    registration.data?.source !== null;
  useDomainHistory(domain, { enabled: !isConfirmedUnregistered });

  // Parent handles unregistered case, but we still check here as a safeguard
  // (this component may briefly render before parent re-renders)
  if (isConfirmedUnregistered) {
    return null;
  }

  return <ReportSections domain={domain} />;
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

  // Non-suspending query to get registration data for:
  // 1. domainId (for screenshot popover)
  // 2. Checking if domain is confirmed unregistered (to hide header/nav)
  const { data: registration } = useQuery(
    trpc.domain.getRegistration.queryOptions({ domain }),
  );
  const domainId = registration?.data?.domainId;

  // Check if domain is confirmed unregistered (hide header/nav in this case)
  const isConfirmedUnregistered =
    registration?.data?.isRegistered === false &&
    registration?.data?.source !== null;

  // Section navigation - tracks active section and header visibility for context injection
  const headerRef = useRef<HTMLDivElement>(null);
  const { activeSection, isHeaderVisible, scrollToSection } =
    useReportSectionObserver({
      sectionIds: Object.keys(sections),
      headerRef,
    });

  // Track export state and get export handler
  const { handleExport, allDataLoaded } = useReportExport(domain);

  // For confirmed unregistered domains, show only the unregistered card
  if (isConfirmedUnregistered) {
    return <DomainUnregisteredCard domain={domain} />;
  }

  return (
    <div>
      {/* Page header - renders immediately with domain name */}
      <DomainReportHeader
        domain={domain}
        domainId={domainId}
        isRegistered={registration?.data?.isRegistered === true}
        onExport={handleExport}
        exportDisabled={!allDataLoaded}
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

      {/* Content area with suspense boundary for registration check */}
      <Suspense fallback={<SectionsSkeleton />}>
        <ReportContent domain={domain} />
      </Suspense>
    </div>
  );
}

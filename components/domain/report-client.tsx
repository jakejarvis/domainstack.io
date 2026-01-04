"use client";

import { useSuspenseQuery } from "@tanstack/react-query";
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
import { DomainReportSkeleton } from "@/components/domain/report-skeleton";
import { SectionNav } from "@/components/domain/section-nav";
import { SeoSection } from "@/components/domain/seo/seo-section";
import { SeoSectionSkeleton } from "@/components/domain/seo/seo-section-skeleton";
import { DomainUnregisteredCard } from "@/components/domain/unregistered-card";
import { useDomainExport } from "@/hooks/use-domain-export";
import { useDomainHistory } from "@/hooks/use-domain-history";
import { useSectionObserver } from "@/hooks/use-section-observer";
import { sections } from "@/lib/constants/sections";
import { useTRPC } from "@/lib/trpc/client";

// Section content components that fetch and render data
function RegistrationSectionContent({ domain }: { domain: string }) {
  const trpc = useTRPC();
  const { data } = useSuspenseQuery(
    trpc.domain.getRegistration.queryOptions({ domain }),
  );
  return <RegistrationSection domain={domain} data={data} />;
}

function HostingSectionContent({ domain }: { domain: string }) {
  const trpc = useTRPC();
  const { data } = useSuspenseQuery(
    trpc.domain.getHosting.queryOptions({ domain }),
  );
  return <HostingSection domain={domain} data={data} />;
}

function DnsSectionContent({ domain }: { domain: string }) {
  const trpc = useTRPC();
  const { data } = useSuspenseQuery(
    trpc.domain.getDnsRecords.queryOptions({ domain }),
  );
  return <DnsSection domain={domain} data={data} />;
}

function CertificatesSectionContent({ domain }: { domain: string }) {
  const trpc = useTRPC();
  const { data } = useSuspenseQuery(
    trpc.domain.getCertificates.queryOptions({ domain }),
  );
  return <CertificatesSection domain={domain} data={data} />;
}

function HeadersSectionContent({ domain }: { domain: string }) {
  const trpc = useTRPC();
  const { data } = useSuspenseQuery(
    trpc.domain.getHeaders.queryOptions({ domain }),
  );
  return <HeadersSection domain={domain} data={data} />;
}

function SeoSectionContent({ domain }: { domain: string }) {
  const trpc = useTRPC();
  const { data } = useSuspenseQuery(
    trpc.domain.getSeo.queryOptions({ domain }),
  );
  return <SeoSection domain={domain} data={data} />;
}

/**
 * Inner content component - queries registration and conditionally shows sections.
 * This component suspends until registration data is ready.
 */
function DomainReportClientContent({ domain }: { domain: string }) {
  const trpc = useTRPC();
  const { data: registration } = useSuspenseQuery(
    trpc.domain.getRegistration.queryOptions({ domain }),
  );

  // Section navigation - tracks active section and header visibility for context injection
  const headerRef = useRef<HTMLDivElement>(null);
  const { activeSection, isHeaderVisible, scrollToSection } =
    useSectionObserver({
      sectionIds: Object.keys(sections),
      headerRef,
    });

  // Show unregistered state if confirmed unregistered
  const isConfirmedUnregistered =
    registration.isRegistered === false && registration.source !== null;

  // Add to search history (only for registered domains)
  useDomainHistory(isConfirmedUnregistered ? "" : domain);

  // Track export state and get export handler
  const { handleExport, allDataLoaded } = useDomainExport(domain);

  if (isConfirmedUnregistered) {
    return <DomainUnregisteredCard domain={domain} />;
  }

  return (
    <div>
      {/* Page header - observed for visibility to trigger context injection */}
      <DomainReportHeader
        domain={domain}
        onExport={handleExport}
        exportDisabled={!allDataLoaded}
        ref={headerRef}
      />

      {/* Sticky section nav with context injection */}
      <SectionNav
        domain={domain}
        sections={Object.values(sections)}
        activeSection={activeSection}
        isHeaderVisible={isHeaderVisible}
        onSectionClick={scrollToSection}
      />

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
    </div>
  );
}

export function DomainReportClient({ domain }: { domain: string }) {
  return (
    <Suspense fallback={<DomainReportSkeleton />}>
      <DomainReportClientContent domain={domain} />
    </Suspense>
  );
}

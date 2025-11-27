"use client";

import { useSuspenseQuery } from "@tanstack/react-query";
import { Suspense } from "react";
import { CertificatesSection } from "@/components/domain/certificates/certificates-section";
import { CertificatesSectionSkeleton } from "@/components/domain/certificates/certificates-section-skeleton";
import { DnsSection } from "@/components/domain/dns/dns-section";
import { DnsSectionSkeleton } from "@/components/domain/dns/dns-section-skeleton";
import { DomainLoadingState } from "@/components/domain/domain-loading-state";
import { DomainReportHeader } from "@/components/domain/domain-report-header";
import { DomainUnregisteredState } from "@/components/domain/domain-unregistered-state";
import { HeadersSection } from "@/components/domain/headers/headers-section";
import { HeadersSectionSkeleton } from "@/components/domain/headers/headers-section-skeleton";
import { HostingSection } from "@/components/domain/hosting/hosting-section";
import { HostingSectionSkeleton } from "@/components/domain/hosting/hosting-section-skeleton";
import { RegistrationSection } from "@/components/domain/registration/registration-section";
import { RegistrationSectionSkeleton } from "@/components/domain/registration/registration-section-skeleton";
import { SectionErrorBoundary } from "@/components/domain/section-error-boundary";
import { SeoSection } from "@/components/domain/seo/seo-section";
import { SeoSectionSkeleton } from "@/components/domain/seo/seo-section-skeleton";
import { useDomainExport } from "@/hooks/use-domain-export";
import { useDomainHistory } from "@/hooks/use-domain-history";
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
function DomainReportContent({ domain }: { domain: string }) {
  const trpc = useTRPC();
  const { data: registration } = useSuspenseQuery(
    trpc.domain.getRegistration.queryOptions({ domain }),
  );

  // Show unregistered state if confirmed unregistered
  const isConfirmedUnregistered =
    registration.isRegistered === false && registration.source !== null;

  // Add to search history (only for registered domains)
  useDomainHistory(isConfirmedUnregistered ? "" : domain);

  // Track export state and get export handler
  const { handleExport, allDataLoaded } = useDomainExport(domain);

  if (isConfirmedUnregistered) {
    return <DomainUnregisteredState domain={domain} />;
  }

  return (
    <div className="space-y-4">
      <DomainReportHeader
        domain={domain}
        onExport={handleExport}
        exportDisabled={!allDataLoaded}
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

export function DomainReportView({ domain }: { domain: string }) {
  return (
    <Suspense fallback={<DomainLoadingState />}>
      <DomainReportContent domain={domain} />
    </Suspense>
  );
}

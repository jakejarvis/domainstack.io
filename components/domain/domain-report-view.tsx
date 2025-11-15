"use client";

import { Suspense } from "react";
import { CertificatesSection } from "@/components/domain/certificates/certificates-section";
import { CertificatesSectionSkeleton } from "@/components/domain/certificates/certificates-section-skeleton";
import { createSectionWithData } from "@/components/domain/create-section-with-data";
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
import { SeoSection } from "@/components/domain/seo/seo-section";
import { SeoSectionSkeleton } from "@/components/domain/seo/seo-section-skeleton";
import { useDomainExport } from "@/hooks/use-domain-export";
import { useDomainHistory } from "@/hooks/use-domain-history";
import {
  useCertificatesQuery,
  useDnsQuery,
  useHeadersQuery,
  useHostingQuery,
  useRegistrationQuery,
  useSeoQuery,
} from "@/hooks/use-domain-queries";
import { useDomainQueryKeys } from "@/hooks/use-domain-query-keys";

// Create section components using the factory
const RegistrationSectionWithData = createSectionWithData(
  useRegistrationQuery,
  RegistrationSection,
  RegistrationSectionSkeleton,
  "Registration",
);

const HostingSectionWithData = createSectionWithData(
  useHostingQuery,
  HostingSection,
  HostingSectionSkeleton,
  "Hosting",
);

const DnsSectionWithData = createSectionWithData(
  useDnsQuery,
  DnsSection,
  DnsSectionSkeleton,
  "DNS",
);

const CertificatesSectionWithData = createSectionWithData(
  useCertificatesQuery,
  CertificatesSection,
  CertificatesSectionSkeleton,
  "Certificates",
);

const HeadersSectionWithData = createSectionWithData(
  useHeadersQuery,
  HeadersSection,
  HeadersSectionSkeleton,
  "Headers",
);

const SeoSectionWithData = createSectionWithData(
  useSeoQuery,
  SeoSection,
  SeoSectionSkeleton,
  "SEO",
);

/**
 * Inner content component - queries registration and conditionally shows sections.
 * This component suspends until registration data is ready.
 */
function DomainReportContent({ domain }: { domain: string }) {
  const { data: registration } = useRegistrationQuery(domain);

  // Show unregistered state if confirmed unregistered
  const isConfirmedUnregistered =
    registration.isRegistered === false && registration.source !== null;

  // Add to search history (only for registered domains)
  useDomainHistory(isConfirmedUnregistered ? "" : domain);

  // Get memoized query keys for all sections
  const queryKeys = useDomainQueryKeys(domain);

  // Track export state and get export handler
  const { handleExport, allDataLoaded } = useDomainExport(domain, queryKeys);

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
        <RegistrationSectionWithData domain={domain} />
        <HostingSectionWithData domain={domain} />
        <DnsSectionWithData domain={domain} />
        <CertificatesSectionWithData domain={domain} />
        <HeadersSectionWithData domain={domain} />
        <SeoSectionWithData domain={domain} />
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

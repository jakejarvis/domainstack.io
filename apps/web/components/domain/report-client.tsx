"use client";

import { IconAlertTriangle, IconRefresh } from "@tabler/icons-react";
import {
  type QueryKey,
  useQuery,
  useQueryClient,
  useSuspenseQuery,
  type UseSuspenseQueryOptions,
} from "@tanstack/react-query";
import { Suspense, useEffect, useRef, useState } from "react";

import { CreateIssueButton } from "@/components/create-issue-button";
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
import { ReportSection } from "@/components/domain/report-section";
import { SectionErrorBoundary } from "@/components/domain/report-section-error-boundary";
import { SectionFailedAlert } from "@/components/domain/section-failed-alert";
import { SeoSection } from "@/components/domain/seo/seo-section";
import { SeoSectionSkeleton } from "@/components/domain/seo/seo-section-skeleton";
import { DomainUnregisteredCard } from "@/components/domain/unregistered-card";
import { useSectionTracking } from "@/hooks/use-section-tracking";
import { analytics } from "@/lib/analytics/client";
import { getLookupErrorMessage } from "@/lib/constants/lookup-errors";
import { sections } from "@/lib/constants/sections";
import { useSearchHistoryStore } from "@/lib/stores/search-history-store";
import { useTRPC } from "@/lib/trpc/client";
import type { Section as SectionId } from "@domainstack/constants";
import type { LookupError, LookupOutcome } from "@domainstack/core/lookup";
import { Button } from "@domainstack/ui/button";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@domainstack/ui/empty";

const SECTION_IDS = Object.keys(sections);

const staticQueryOptions = {
  staleTime: Number.POSITIVE_INFINITY,
  retry: false,
  refetchOnMount: false,
  refetchOnWindowFocus: false,
  refetchOnReconnect: false,
} as const;

type Trpc = ReturnType<typeof useTRPC>;

/**
 * A hostname-scoped report section. It loads independently of registration, so
 * a slow or failed RDAP/WHOIS lookup never holds it back.
 * `sectionName` labels its error boundary (and the exception analytics).
 */
function reportSection<T, TError, TKey extends QueryKey>({
  id,
  sectionName,
  queryOptions,
  Section,
  Skeleton,
}: {
  id: Exclude<SectionId, "registration">;
  sectionName: string;
  queryOptions: (
    trpc: Trpc,
    domain: string,
  ) => UseSuspenseQueryOptions<LookupOutcome<T>, TError, LookupOutcome<T>, TKey>;
  Section: React.ComponentType<{ domain: string; data: NoInfer<T> }>;
  Skeleton: React.ComponentType;
}) {
  function Loaded({ domain }: { domain: string }) {
    const trpc = useTRPC();
    const { data } = useSuspenseQuery(queryOptions(trpc, domain));

    if (!data.success) {
      return <SectionFailedAlert section={sections[id]} error={data.error} />;
    }
    return <Section domain={domain} data={data.data} />;
  }
  // Distinct names in React DevTools and error-boundary component stacks.
  Loaded.displayName = `Suspended${sectionName}Section`;

  return { id, sectionName, Loaded, Skeleton };
}

/**
 * Every section after registration, in page order. The `queryOptions` params
 * are annotated because TypeScript can't infer `T` through an unannotated callback.
 */
const REPORT_SECTIONS = [
  reportSection({
    id: "hosting",
    sectionName: "Hosting",
    queryOptions: (trpc: Trpc, domain: string) =>
      trpc.domain.getHosting.queryOptions({ domain }, staticQueryOptions),
    Section: HostingSection,
    Skeleton: HostingSectionSkeleton,
  }),
  reportSection({
    id: "dns",
    sectionName: "DNS",
    queryOptions: (trpc: Trpc, domain: string) =>
      trpc.domain.getDnsRecords.queryOptions({ domain }, staticQueryOptions),
    Section: DnsSection,
    Skeleton: DnsSectionSkeleton,
  }),
  reportSection({
    id: "certificates",
    sectionName: "Certificates",
    queryOptions: (trpc: Trpc, domain: string) =>
      trpc.domain.getCertificates.queryOptions({ domain }, staticQueryOptions),
    Section: CertificatesSection,
    Skeleton: CertificatesSectionSkeleton,
  }),
  reportSection({
    id: "headers",
    sectionName: "Headers",
    queryOptions: (trpc: Trpc, domain: string) =>
      trpc.domain.getHeaders.queryOptions({ domain }, staticQueryOptions),
    Section: HeadersSection,
    Skeleton: HeadersSectionSkeleton,
  }),
  reportSection({
    id: "seo",
    sectionName: "SEO",
    queryOptions: (trpc: Trpc, domain: string) =>
      trpc.domain.getSeo.queryOptions({ domain }, staticQueryOptions),
    Section: SeoSection,
    Skeleton: SeoSectionSkeleton,
  }),
];

function useDomainReportTracking(domain: string, isRegistered: boolean) {
  const addDomainToHistory = useSearchHistoryStore((s) => s.addDomain);
  useEffect(() => {
    if (isRegistered) {
      addDomainToHistory(domain);
    }
  }, [isRegistered, domain, addDomainToHistory]);

  const viewedDomainRef = useRef<string | null>(null);
  useEffect(() => {
    if (!isRegistered || viewedDomainRef.current === domain) {
      return;
    }
    viewedDomainRef.current = domain;
    analytics.track("report_viewed", { domain });
  }, [domain, isRegistered]);

  const headerRef = useRef<HTMLDivElement>(null);
  const [isHeaderVisible, setIsHeaderVisible] = useState(true);
  const { activeSection, scrollToSection } = useSectionTracking(SECTION_IDS);

  useEffect(() => {
    const headerElement = headerRef.current;
    if (!headerElement) return;

    const observer = new IntersectionObserver(
      (entries) => {
        setIsHeaderVisible(entries[0].isIntersecting);
      },
      {
        threshold: 0,
        rootMargin: "-10px 0px 0px 0px",
      },
    );

    observer.observe(headerElement);
    return () => observer.disconnect();
  }, []);

  return { headerRef, isHeaderVisible, activeSection, scrollToSection };
}

function getReportErrorDescription({
  isRegistrationError,
  registrationError,
  lookupFailed,
  registration,
}: {
  isRegistrationError: boolean;
  registrationError: unknown;
  lookupFailed: boolean;
  registration: { success: false; error: LookupError } | { success: true } | null | undefined;
}) {
  if (
    process.env.NODE_ENV === "development" &&
    isRegistrationError &&
    registrationError instanceof Error
  ) {
    return registrationError.message;
  }
  if (lookupFailed && registration && !registration.success) {
    return getLookupErrorMessage(registration.error);
  }
  return "We couldn't fetch registration data for this domain. Please try again.";
}

/**
 * Registration failed to load. Only the registration section shows the
 * failure; the hostname sections below still render their own data.
 */
function RegistrationLoadError({
  domain,
  scope,
  registrationError,
  description,
}: {
  /** The registrable domain the registration query is keyed by. */
  domain: string;
  scope?: string;
  registrationError: unknown;
  description: string;
}) {
  const trpc = useTRPC();
  const queryClient = useQueryClient();

  return (
    <ReportSection {...sections.registration} scope={scope}>
      <Empty className="border border-dashed">
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <IconAlertTriangle />
          </EmptyMedia>
          <EmptyTitle>Failed to load registration data</EmptyTitle>
          <EmptyDescription>{description}</EmptyDescription>
        </EmptyHeader>
        <EmptyContent>
          <div className="flex flex-wrap items-center justify-center gap-2">
            <Button
              size="sm"
              onClick={() =>
                queryClient.invalidateQueries(trpc.domain.getRegistration.queryFilter({ domain }))
              }
            >
              <IconRefresh />
              Retry
            </Button>
            <CreateIssueButton
              error={registrationError instanceof Error ? registrationError : undefined}
              variant="outline"
              size="sm"
            />
          </div>
        </EmptyContent>
      </Empty>
    </ReportSection>
  );
}

function DomainReportSections({ children }: { children: React.ReactNode }) {
  return <div className="space-y-4">{children}</div>;
}

export function DomainReportClient({
  hostname,
  hostnameId,
  registrableDomain,
  pricingTld,
}: {
  /** The exact hostname this report describes. */
  hostname: string;
  /** Id of the hostname's own `domains` row; keys hostname-scoped features like screenshots. */
  hostnameId?: string;
  /** The hostname's registrable domain, which owns registration and tracking. */
  registrableDomain: string;
  pricingTld: string | null;
}) {
  const trpc = useTRPC();
  const isSubdomain = hostname !== registrableDomain;
  const {
    data: registration,
    isLoading: isRegistrationLoading,
    isError: isRegistrationError,
    error: registrationError,
  } = useQuery(
    trpc.domain.getRegistration.queryOptions({ domain: registrableDomain }, staticQueryOptions),
  );
  const registrationData = registration?.success ? registration.data : undefined;
  const lookupFailed = Boolean(registration && !registration.success);
  const isRegistered = registrationData?.isRegistered === true;
  const isUnregistered = registrationData?.isRegistered === false;
  const { headerRef, isHeaderVisible, activeSection, scrollToSection } = useDomainReportTracking(
    hostname,
    isRegistered,
  );
  // Registration describes the parent, so name it when the report is a subdomain's.
  const registrationScope = isSubdomain ? registrableDomain : undefined;

  if (!isRegistrationLoading && isUnregistered) {
    // A subdomain of an unregistered domain is not itself for sale: explain the
    // parent's state instead of offering registrar pricing.
    return isSubdomain ? (
      <DomainUnregisteredCard domain={registrableDomain} hostname={hostname} pricingTld={null} />
    ) : (
      <DomainUnregisteredCard domain={registrableDomain} pricingTld={pricingTld} />
    );
  }

  return (
    <>
      <DomainReportHeader
        hostname={hostname}
        registrableDomain={registrableDomain}
        domainId={hostnameId}
        isReady={!isRegistrationLoading}
        isRegistered={isRegistered}
        ref={headerRef}
      />

      <SectionNav
        domain={hostname}
        sections={Object.values(sections)}
        activeSection={activeSection}
        isHeaderVisible={isHeaderVisible}
        onSectionClick={scrollToSection}
      />

      <DomainReportSections>
        {isRegistrationLoading ? (
          <RegistrationSectionSkeleton />
        ) : isRegistrationError || lookupFailed ? (
          <RegistrationLoadError
            domain={registrableDomain}
            scope={registrationScope}
            registrationError={registrationError}
            description={getReportErrorDescription({
              isRegistrationError,
              registrationError,
              lookupFailed,
              registration,
            })}
          />
        ) : (
          <RegistrationSection
            domain={registrableDomain}
            scope={registrationScope}
            data={registrationData}
          />
        )}
        {REPORT_SECTIONS.map(({ id, sectionName, Loaded, Skeleton }) => (
          <SectionErrorBoundary key={id} sectionName={sectionName}>
            <Suspense fallback={<Skeleton />}>
              <Loaded domain={hostname} />
            </Suspense>
          </SectionErrorBoundary>
        ))}
      </DomainReportSections>
    </>
  );
}

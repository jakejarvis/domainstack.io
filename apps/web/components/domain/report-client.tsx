"use client";

import { Button } from "@domainstack/ui/button";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@domainstack/ui/empty";
import { IconAlertTriangle, IconRefresh } from "@tabler/icons-react";
import {
  useQuery,
  useQueryClient,
  useSuspenseQuery,
} from "@tanstack/react-query";
import { useSetAtom } from "jotai";
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
import { SectionErrorBoundary } from "@/components/domain/report-section-error-boundary";
import { SectionFailedAlert } from "@/components/domain/section-failed-alert";
import { SeoSection } from "@/components/domain/seo/seo-section";
import { SeoSectionSkeleton } from "@/components/domain/seo/seo-section-skeleton";
import { DomainUnregisteredCard } from "@/components/domain/unregistered-card";
import { useIsMobile } from "@/hooks/use-mobile";
import { useSectionTracking } from "@/hooks/use-section-tracking";
import { chatContextAtom } from "@/lib/atoms/chat-atoms";
import {
  HEADER_HEIGHT,
  SCROLL_PADDING,
  SECTION_NAV_HEIGHT,
} from "@/lib/constants/layout";
import { sections } from "@/lib/constants/sections";
import { useSearchHistoryStore } from "@/lib/stores/search-history-store";
import { useTRPC } from "@/lib/trpc/client";

function resolveScrollMargin(isMobile: boolean) {
  const headerHeight = !isMobile ? HEADER_HEIGHT : 0;
  return headerHeight + SECTION_NAV_HEIGHT + SCROLL_PADDING;
}

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

const staticQueryOptions = {
  staleTime: Number.POSITIVE_INFINITY,
  retry: false,
  refetchOnMount: false,
  refetchOnWindowFocus: false,
  refetchOnReconnect: false,
} as const;

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

export function DomainReportClient({ domain }: { domain: string }) {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const registrationQueryOptions = trpc.domain.getRegistration.queryOptions({
    domain,
  });
  const {
    data: registration,
    isLoading: isRegistrationLoading,
    isError: isRegistrationError,
    error: registrationError,
  } = useQuery({
    ...registrationQueryOptions,
    ...staticQueryOptions,
  });
  const domainId = registration?.data?.domainId;
  const isRegistered = registration?.data?.isRegistered === true;

  // Add to search history for registered domains
  const addDomainToHistory = useSearchHistoryStore((s) => s.addDomain);
  useEffect(() => {
    if (isRegistered) {
      addDomainToHistory(domain);
    }
  }, [isRegistered, domain, addDomainToHistory]);

  // Set chat context for domain-specific suggestions
  const setChatContext = useSetAtom(chatContextAtom);
  useEffect(() => {
    setChatContext({ type: "report", domain });
    return () => setChatContext({ type: "home" });
  }, [domain, setChatContext]);

  const headerRef = useRef<HTMLDivElement>(null);
  const sectionIds = Object.keys(sections);
  const [isHeaderVisible, setIsHeaderVisible] = useState(true);
  const isMobile = useIsMobile();

  // Section tracking with scroll detection
  const { activeSection, scrollToSection } = useSectionTracking({
    sectionIds,
    scrollMarginPx: resolveScrollMargin(isMobile),
  });

  // Header observer
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

  if (isRegistrationError) {
    const isDev = process.env.NODE_ENV === "development";
    return (
      <Empty className="border border-dashed">
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <IconAlertTriangle />
          </EmptyMedia>
          <EmptyTitle>Failed to load domain report</EmptyTitle>
          <EmptyDescription>
            {isDev && registrationError
              ? registrationError.message
              : "We couldn't fetch registration data for this domain. Please try again."}
          </EmptyDescription>
        </EmptyHeader>
        <EmptyContent>
          <div className="flex flex-wrap items-center justify-center gap-2">
            <Button
              size="sm"
              onClick={() =>
                queryClient.invalidateQueries({
                  queryKey: registrationQueryOptions.queryKey,
                })
              }
            >
              <IconRefresh />
              Retry
            </Button>
            <CreateIssueButton
              error={
                registrationError instanceof Error
                  ? registrationError
                  : undefined
              }
              variant="outline"
              size="sm"
            />
          </div>
        </EmptyContent>
      </Empty>
    );
  }

  if (!isRegistrationLoading && !isRegistered) {
    return <DomainUnregisteredCard domain={domain} />;
  }

  return (
    <div>
      <DomainReportHeader
        domain={domain}
        domainId={domainId}
        isRegistered={isRegistered}
        ref={headerRef}
      />

      <SectionNav
        domain={domain}
        sections={Object.values(sections)}
        activeSection={activeSection}
        isHeaderVisible={isHeaderVisible}
        onSectionClick={scrollToSection}
      />

      <div className="space-y-4">
        {isRegistrationLoading ? (
          <RegistrationSectionSkeleton />
        ) : (
          <RegistrationSection domain={domain} data={registration?.data} />
        )}

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

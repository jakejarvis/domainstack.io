"use client";

import { Download, ExternalLink } from "lucide-react";
import Link from "next/link";
import { Accordion } from "@/components/ui/accordion";
import { Button } from "@/components/ui/button";
import { captureClient } from "@/lib/analytics/client";
import type { RegistrationWithProvider } from "@/lib/schemas";
import { useDomainHistory } from "../../hooks/use-domain-history";
import { useDomainQueries } from "../../hooks/use-domain-queries";
import { useTtlPreferences } from "../../hooks/use-ttl-preferences";
import { DomainLoadingState } from "./domain-loading-state";
import { DomainUnregisteredState } from "./domain-unregistered-state";
import { exportDomainData } from "./export-data";
import { Favicon } from "./favicon";
import { ScreenshotTooltip } from "./screenshot-tooltip";
import { CertificatesSection } from "./sections/certificates-section";
import { DnsRecordsSection } from "./sections/dns-records-section";
import { HeadersSection } from "./sections/headers-section";
import { HostingEmailSection } from "./sections/hosting-email-section";
import { RegistrationSection } from "./sections/registration-section";
import { SeoSection } from "./sections/seo-section";

export function DomainReportView({
  domain,
  initialRegistration,
  initialRegistered,
}: {
  domain: string;
  initialRegistration?: RegistrationWithProvider;
  initialRegistered?: boolean;
}) {
  const { registration, dns, hosting, certs, headers, seo, allSectionsReady } =
    useDomainQueries(domain, { initialRegistration, initialRegistered });
  const { showTtls, setShowTtls } = useTtlPreferences();

  // Manage domain history
  useDomainHistory(
    domain,
    registration.isSuccess,
    registration.data?.isRegistered ?? false,
  );

  const handleExportJson = () => {
    captureClient("export_json_clicked", { domain });
    exportDomainData(domain, {
      registration: registration.data,
      dns: dns.data,
      hosting: hosting.data,
      certificates: certs.data,
      headers: headers.data,
    });
  };

  // Show loading state until WHOIS completes
  if (registration.isLoading) {
    return <DomainLoadingState />;
  }

  // Show unregistered state if domain is not registered
  const isUnregistered =
    registration.isSuccess && registration.data?.isRegistered === false;
  if (isUnregistered) {
    captureClient("report_unregistered_viewed", { domain });
    return <DomainUnregisteredState domain={domain} />;
  }

  const dnsLoading = dns.isLoading;
  const hasAnyIp =
    dns.data?.records?.some((r) => r.type === "A" || r.type === "AAAA") ??
    false;

  function gateByDns<T>(q: { isLoading: boolean; data?: T[] | null }): {
    isLoading: boolean;
    data: T[] | null;
  };
  function gateByDns<T>(
    q: { isLoading: boolean; data?: T | null },
    opts: { single: true },
  ): { isLoading: boolean; data: T | null };
  function gateByDns<T>(
    q: { isLoading: boolean; data?: T[] | T | null },
    opts?: { single?: boolean },
  ) {
    if (dnsLoading) {
      return { isLoading: true, data: null as unknown } as {
        isLoading: boolean;
        data: T[] | T | null;
      };
    }
    if (hasAnyIp) {
      return {
        isLoading: q.isLoading,
        data: (q.data ?? null) as unknown,
      } as { isLoading: boolean; data: T[] | T | null };
    }
    if (opts?.single) {
      return { isLoading: false, data: null as unknown } as {
        isLoading: boolean;
        data: T | null;
      };
    }
    return { isLoading: false, data: [] as unknown } as {
      isLoading: boolean;
      data: T[] | null;
    };
  }

  const certsView = gateByDns(certs);
  const headersView = gateByDns(headers);
  const seoView = gateByDns(seo, { single: true });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <ScreenshotTooltip domain={domain}>
            <Link
              href={`https://${domain}`}
              target="_blank"
              rel="noopener"
              className="flex items-center gap-2"
              onClick={() =>
                captureClient("external_domain_link_clicked", { domain })
              }
            >
              <Favicon domain={domain} size={20} className="rounded" />
              <h2 className="text-xl font-semibold tracking-tight">{domain}</h2>
              <ExternalLink
                className="h-4 w-4 text-muted-foreground/60"
                aria-hidden="true"
              />
            </Link>
          </ScreenshotTooltip>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleExportJson}
            disabled={!allSectionsReady}
          >
            <Download className="h-4 w-4" /> Export JSON
          </Button>
        </div>
      </div>

      <Accordion type="multiple" className="space-y-4">
        <RegistrationSection
          data={registration.data || null}
          isLoading={registration.isLoading}
          isError={!!registration.isError}
          onRetryAction={() => {
            captureClient("section_refetch_clicked", {
              domain,
              section: "registration",
            });
            registration.refetch();
          }}
        />

        <HostingEmailSection
          data={hosting.data || null}
          isLoading={hosting.isLoading}
          isError={!!hosting.isError}
          onRetryAction={() => {
            captureClient("section_refetch_clicked", {
              domain,
              section: "hosting",
            });
            hosting.refetch();
          }}
        />

        <DnsRecordsSection
          records={dns.data?.records || null}
          isLoading={dns.isLoading}
          isError={!!dns.isError}
          onRetryAction={() => {
            captureClient("section_refetch_clicked", {
              domain,
              section: "dns",
            });
            dns.refetch();
          }}
          showTtls={showTtls}
          onToggleTtlsAction={(v) => {
            captureClient("ttl_preference_toggled", {
              domain,
              show_ttls: v,
            });
            setShowTtls(v);
          }}
        />

        <CertificatesSection
          data={certsView.data}
          isLoading={certsView.isLoading}
          isError={!!certs.isError}
          onRetryAction={() => {
            captureClient("section_refetch_clicked", {
              domain,
              section: "certificates",
            });
            certs.refetch();
          }}
        />

        <HeadersSection
          data={headersView.data}
          isLoading={headersView.isLoading}
          isError={!!headers.isError}
          onRetryAction={() => {
            captureClient("section_refetch_clicked", {
              domain,
              section: "headers",
            });
            headers.refetch();
          }}
        />

        <SeoSection
          data={seoView.data}
          isLoading={seoView.isLoading}
          isError={!!seo?.isError}
          onRetryAction={() => {
            captureClient("section_refetch_clicked", {
              domain,
              section: "seo",
            });
            seo.refetch();
          }}
        />
      </Accordion>
    </div>
  );
}

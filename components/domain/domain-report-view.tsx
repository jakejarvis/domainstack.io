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
}: {
  domain: string;
  initialRegistration?: RegistrationWithProvider;
  initialRegistered?: boolean;
}) {
  const { registration, dns, hosting, certs, headers, seo } =
    useDomainQueries(domain);
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
          <Button variant="outline" size="sm" onClick={handleExportJson}>
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
          data={certs.data || null}
          isLoading={certs.isLoading}
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
          data={headers.data || null}
          isLoading={headers.isLoading}
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
          data={seo.data || null}
          isLoading={seo.isLoading}
          isError={!!seo.isError}
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

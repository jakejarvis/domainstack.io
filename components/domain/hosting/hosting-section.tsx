import { QuestionIcon } from "@phosphor-icons/react/ssr";
import { HostingMapClient } from "@/components/domain/hosting/hosting-map-client";
import { KeyValue } from "@/components/domain/key-value";
import { KeyValueGrid } from "@/components/domain/key-value-grid";
import { ReportSection } from "@/components/domain/report-section";
import { ProviderIcon } from "@/components/icons/provider-icon";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { sections } from "@/lib/constants/sections";
import { countryCodeToEmoji } from "@/lib/country-emoji";
import type { HostingGeo, HostingResponse } from "@/lib/types/domain/hosting";

function formatLocation(geo: HostingGeo): string {
  const parts = [geo.city, geo.region, geo.country].filter(Boolean);
  return parts.join(", ");
}

export function HostingSection({
  domain,
  data,
}: {
  domain?: string;
  data?: HostingResponse | null;
}) {
  const dnsProvider = data?.dnsProvider ?? null;
  const hostingProvider = data?.hostingProvider ?? null;
  const emailProvider = data?.emailProvider ?? null;
  const hasAnyProvider =
    dnsProvider?.name || hostingProvider?.name || emailProvider?.name;
  const geolocation = data?.geo ?? null;

  return (
    <ReportSection {...sections.hosting}>
      {hasAnyProvider ? (
        <>
          <KeyValueGrid colsDesktop={3}>
            <KeyValue
              label="DNS"
              value={dnsProvider?.name ?? "Not configured"}
              leading={
                dnsProvider?.id ? (
                  <ProviderIcon
                    providerId={dnsProvider.id}
                    providerName={dnsProvider.name}
                    providerDomain={dnsProvider.domain}
                  />
                ) : undefined
              }
            />
            <KeyValue
              label="Hosting"
              value={hostingProvider?.name ?? "Not configured"}
              leading={
                hostingProvider?.id ? (
                  <ProviderIcon
                    providerId={hostingProvider.id}
                    providerName={hostingProvider.name}
                    providerDomain={hostingProvider.domain}
                  />
                ) : undefined
              }
            />
            <KeyValue
              label="Email"
              value={emailProvider?.name ?? "Not configured"}
              leading={
                emailProvider?.id ? (
                  <ProviderIcon
                    providerId={emailProvider.id}
                    providerName={emailProvider.name}
                    providerDomain={emailProvider.domain}
                  />
                ) : undefined
              }
            />
          </KeyValueGrid>

          {geolocation ? (
            <>
              <KeyValue
                label="Location"
                value={formatLocation(geolocation)}
                leading={
                  geolocation.country_code ? (
                    <span
                      title={geolocation.country || geolocation.country_code}
                      className="text-lg leading-none"
                    >
                      {countryCodeToEmoji(geolocation.country_code)}
                    </span>
                  ) : undefined
                }
              />

              {geolocation.lat && geolocation.lon ? (
                <div className="relative h-[280px] w-full">
                  <HostingMapClient
                    lat={geolocation.lat}
                    lon={geolocation.lon}
                    domain={domain}
                  />
                </div>
              ) : null}
            </>
          ) : null}
        </>
      ) : (
        <Empty className="border border-dashed">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <QuestionIcon />
            </EmptyMedia>
            <EmptyTitle>No hosting details available</EmptyTitle>
            <EmptyDescription>
              We couldn&apos;t detect hosting, email, or DNS provider info. If
              the domain has no A/AAAA records or blocked headers, details may
              be unavailable.
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      )}
    </ReportSection>
  );
}

import type { HostingGeo, HostingResponse } from "@domainstack/types";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@domainstack/ui/empty";
import { countryCodeToEmoji } from "@domainstack/utils";
import { IconHelp } from "@tabler/icons-react";
import dynamic from "next/dynamic";
import { HostingMapSkeleton } from "@/components/domain/hosting/hosting-map-skeleton";
import { KeyValue } from "@/components/domain/key-value";
import { KeyValueGrid } from "@/components/domain/key-value-grid";
import { ReportSection } from "@/components/domain/report-section";
import { ProviderLogo } from "@/components/icons/provider-logo";
import { sections } from "@/lib/constants/sections";

const HostingMapClient = dynamic(
  () =>
    import("@/components/domain/hosting/hosting-map-client").then(
      (m) => m.HostingMapClient,
    ),
  {
    ssr: false,
    loading: () => <HostingMapSkeleton />,
  },
);

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
                  <ProviderLogo
                    providerId={dnsProvider.id}
                    providerName={dnsProvider.name}
                  />
                ) : undefined
              }
            />
            <KeyValue
              label="Hosting"
              value={hostingProvider?.name ?? "Not configured"}
              leading={
                hostingProvider?.id ? (
                  <ProviderLogo
                    providerId={hostingProvider.id}
                    providerName={hostingProvider.name}
                  />
                ) : undefined
              }
            />
            <KeyValue
              label="Email"
              value={emailProvider?.name ?? "Not configured"}
              leading={
                emailProvider?.id ? (
                  <ProviderLogo
                    providerId={emailProvider.id}
                    providerName={emailProvider.name}
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
              <IconHelp />
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

import { IconHelp } from "@tabler/icons-react";

import { HostingMap } from "@/components/domain/hosting/hosting-map";
import { KeyValue } from "@/components/domain/key-value";
import { KeyValueGrid } from "@/components/domain/key-value-grid";
import { ReportSection } from "@/components/domain/report-section";
import { ProviderLogo } from "@/components/icons/provider-logo";
import { sections } from "@/lib/constants/sections";
import type { HostingGeo, HostingResponse } from "@domainstack/types";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@domainstack/ui/empty";
import { countryCodeToEmoji } from "@domainstack/utils/country-emoji";

function formatLocation(geo: HostingGeo): string {
  const parts = [geo.city, geo.region, geo.country].filter(Boolean);
  return parts.join(", ");
}

function ProviderKeyValue({
  label,
  provider,
}: {
  label: string;
  provider: { id?: string | null; name?: string | null } | null;
}) {
  return (
    <KeyValue
      label={label}
      value={provider?.name ?? "Not configured"}
      leading={
        provider?.id ? (
          <ProviderLogo providerId={provider.id} providerName={provider.name} />
        ) : undefined
      }
    />
  );
}

function HostingLocation({ geo, domain }: { geo: HostingGeo; domain?: string }) {
  const { lat, lon } = geo;

  return (
    <>
      <KeyValue
        label="Location"
        value={formatLocation(geo)}
        leading={
          geo.country_code ? (
            <span title={geo.country || geo.country_code} className="text-lg leading-none">
              {countryCodeToEmoji(geo.country_code)}
            </span>
          ) : undefined
        }
      />
      {lat && lon ? (
        <div className="relative h-[280px] w-full">
          <HostingMap lat={lat} lon={lon} domain={domain} />
        </div>
      ) : null}
    </>
  );
}

function EmptyHosting() {
  return (
    <Empty className="border border-dashed">
      <EmptyHeader>
        <EmptyMedia variant="icon">
          <IconHelp />
        </EmptyMedia>
        <EmptyTitle>No hosting details available</EmptyTitle>
        <EmptyDescription>
          We couldn&apos;t detect hosting, email, or DNS provider info. If the domain has no A/AAAA
          records or blocked headers, details may be unavailable.
        </EmptyDescription>
      </EmptyHeader>
    </Empty>
  );
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
  const hasAnyProvider = Boolean(dnsProvider?.name || hostingProvider?.name || emailProvider?.name);
  const geolocation = data?.geo ?? null;

  return (
    <ReportSection {...sections.hosting}>
      {hasAnyProvider ? (
        <>
          <KeyValueGrid colsDesktop={3}>
            <ProviderKeyValue label="DNS" provider={dnsProvider} />
            <ProviderKeyValue label="Hosting" provider={hostingProvider} />
            <ProviderKeyValue label="Email" provider={emailProvider} />
          </KeyValueGrid>
          {geolocation ? <HostingLocation geo={geolocation} domain={domain} /> : null}
        </>
      ) : (
        <EmptyHosting />
      )}
    </ReportSection>
  );
}

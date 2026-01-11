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
import type { HostingResponse } from "@/lib/types/domain/hosting";

function formatLocation(geo: HostingResponse["geo"]): string {
  const parts = [geo.city, geo.region, geo.country].filter(Boolean);
  return parts.join(", ");
}

/**
 * Convert a Unicode code point string to its emoji representation.
 * e.g., "U+1F1FA U+1F1F8" → "🇺🇸"
 */
function unicodeToEmoji(unicode: string): string {
  if (!unicode) return "";
  return unicode
    .split(" ")
    .map((cp) =>
      String.fromCodePoint(Number.parseInt(cp.replace("U+", ""), 16)),
    )
    .join("");
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

          {data?.geo?.lat != null && data?.geo?.lon != null ? (
            <>
              <KeyValue
                label="Location"
                value={formatLocation(data.geo)}
                leading={
                  data.geo.country_emoji ? (
                    <span title={data.geo.country || data.geo.country_code}>
                      {unicodeToEmoji(data.geo.country_emoji)}
                    </span>
                  ) : undefined
                }
              />

              <div className="relative h-[280px] w-full">
                <HostingMapClient
                  lat={data.geo.lat}
                  lon={data.geo.lon}
                  domain={domain}
                />
              </div>
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

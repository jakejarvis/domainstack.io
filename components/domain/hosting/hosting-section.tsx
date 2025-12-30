"use client";

import { hasFlag } from "country-flag-icons";
import { MailQuestionMark } from "lucide-react";
import { HostingMap } from "@/components/domain/hosting/hosting-map";
import { KeyValue } from "@/components/domain/key-value";
import { KeyValueGrid } from "@/components/domain/key-value-grid";
import { Section } from "@/components/domain/section";
import { ProviderIcon } from "@/components/icons/provider-icon";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { sections } from "@/lib/constants/sections";
import type { HostingResponse } from "@/lib/schemas";
import { cn } from "@/lib/utils";

function formatLocation(geo: HostingResponse["geo"]): string {
  const parts = [geo.city, geo.region, geo.country].filter(Boolean);
  return parts.join(", ");
}

export function HostingSection({
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
    <Section {...sections.hosting}>
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
                    size={16}
                    className="rounded"
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
                    size={16}
                    className="rounded"
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
                    size={16}
                    className="rounded"
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
                  data.geo.country_code &&
                  hasFlag(data.geo.country_code.toUpperCase()) ? (
                    <span
                      className={cn(
                        "!w-[15px] !h-[10px] relative top-[2px] inline-block rounded-xs",
                        // https://gitlab.com/catamphetamine/country-flag-icons/-/tree/master/flags/3x2
                        `flag:${data.geo.country_code.toUpperCase()}`,
                      )}
                      aria-hidden="true"
                      title={data.geo.country || data.geo.country_code}
                    />
                  ) : undefined
                }
              />

              <HostingMap hosting={data} />
            </>
          ) : null}
        </>
      ) : (
        <Empty className="border border-dashed">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <MailQuestionMark />
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
    </Section>
  );
}

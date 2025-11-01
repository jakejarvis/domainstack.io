"use client";

import { hasFlag } from "country-flag-icons";
import { MailQuestionMark } from "lucide-react";
import dynamic from "next/dynamic";
import { KeyValue } from "@/components/domain/key-value";
import { KeyValueGrid } from "@/components/domain/key-value-grid";
import { Section } from "@/components/domain/section";
import { Favicon } from "@/components/favicon";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { Spinner } from "@/components/ui/spinner";
import type { Hosting } from "@/lib/schemas";
import { sections } from "@/lib/sections-meta";
import { cn } from "@/lib/utils";

const HostingMap = dynamic(
  () =>
    import("@/components/domain/hosting/hosting-map").then((m) => m.HostingMap),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-[280px] w-full items-center justify-center rounded-2xl border border-black/10 bg-muted/50 shadow-[inset_0_1px_0_rgba(255,255,255,0.08)] backdrop-blur supports-[backdrop-filter]:bg-background/40 dark:border-white/10">
        <div className="flex items-center gap-2 text-muted-foreground text-xs">
          <Spinner />
          <span>Loading map...</span>
        </div>
      </div>
    ),
  },
);

function formatLocation(geo: Hosting["geo"]): string {
  const parts = [geo.city, geo.region, geo.country].filter(Boolean);
  return parts.join(", ");
}

export function HostingSection({ data }: { data?: Hosting | null }) {
  // Early return for empty state - this satisfies TypeScript's control-flow analysis
  if (!data) {
    return (
      <Section {...sections.hosting}>
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
      </Section>
    );
  }

  const hasAnyProvider =
    data.dnsProvider.name ||
    data.hostingProvider.name ||
    data.emailProvider.name;

  return (
    <Section {...sections.hosting}>
      {hasAnyProvider ? (
        <>
          <KeyValueGrid colsDesktop={3}>
            <KeyValue
              label="DNS"
              value={data.dnsProvider.name ?? "Not configured"}
              leading={
                data.dnsProvider.domain ? (
                  <Favicon
                    domain={data.dnsProvider.domain}
                    size={16}
                    className="rounded"
                  />
                ) : undefined
              }
            />
            <KeyValue
              label="Hosting"
              value={data.hostingProvider.name ?? "Not configured"}
              leading={
                data.hostingProvider.domain ? (
                  <Favicon
                    domain={data.hostingProvider.domain}
                    size={16}
                    className="rounded"
                  />
                ) : undefined
              }
            />
            <KeyValue
              label="Email"
              value={data.emailProvider.name ?? "Not configured"}
              leading={
                data.emailProvider.domain ? (
                  <Favicon
                    domain={data.emailProvider.domain}
                    size={16}
                    className="rounded"
                  />
                ) : undefined
              }
            />
          </KeyValueGrid>

          {data.geo.lat != null && data.geo.lon != null ? (
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

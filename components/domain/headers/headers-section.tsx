"use client";

import { Logs, Search } from "lucide-react";
import Link from "next/link";
import { KeyValue } from "@/components/domain/key-value";
import { KeyValueGrid } from "@/components/domain/key-value-grid";
import { Section } from "@/components/domain/section";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { normalizeDomainInput } from "@/lib/domain";
import type { HttpHeader } from "@/lib/schemas";
import { sections } from "@/lib/sections-meta";

const IMPORTANT_HEADERS = new Set([
  "strict-transport-security",
  "content-security-policy",
  "content-security-policy-report-only",
  "x-frame-options",
  "x-content-type-options",
  "referrer-policy",
  "server",
  "x-powered-by",
  "cache-control",
  "permissions-policy",
  "location",
]);

/**
 * Extract domain from a Location header value.
 * Location can be a full URL or a relative path.
 */
function extractDomainFromLocation(locationValue: string): string | null {
  try {
    // Try to parse as URL
    const url = new URL(locationValue);
    return normalizeDomainInput(url.hostname);
  } catch {
    // If it fails, it might be a relative URL, return null
    return null;
  }
}

export function HeadersSection({
  data,
}: {
  domain?: string;
  data?: HttpHeader[] | null;
}) {
  return (
    <Section {...sections.headers}>
      {data && data.length > 0 ? (
        <KeyValueGrid colsDesktop={2}>
          {data.map((h, index) => {
            const isLocation = h.name?.toLowerCase() === "location";
            const locationDomain = isLocation
              ? extractDomainFromLocation(h.value)
              : null;

            return (
              <KeyValue
                key={`header-${h.name}-${index}`}
                label={h.name}
                value={h.value}
                copyable
                highlight={IMPORTANT_HEADERS.has(h.name?.toLowerCase() ?? "")}
                suffix={
                  locationDomain ? (
                    <Link
                      href={`/${locationDomain}`}
                      className="inline-flex items-center text-foreground/80 hover:text-muted-foreground"
                      title={`View report for ${locationDomain}`}
                    >
                      <Search className="h-4 w-4" />
                    </Link>
                  ) : undefined
                }
              />
            );
          })}
        </KeyValueGrid>
      ) : (
        <Empty className="border border-dashed">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <Logs />
            </EmptyMedia>
            <EmptyTitle>No HTTP headers detected</EmptyTitle>
            <EmptyDescription>
              We couldn&apos;t fetch any HTTP response headers for this site. It
              may be offline or blocking requests.
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      )}
    </Section>
  );
}

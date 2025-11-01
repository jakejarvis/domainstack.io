"use client";

import { Logs } from "lucide-react";
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
import type { HttpHeader } from "@/lib/schemas";
import { sections } from "@/lib/sections-meta";

const IMPORTANT_HEADERS = new Set([
  "strict-transport-security",
  "content-security-policy",
  "content-security-policy-report-only",
  "x-frame-options",
  "referrer-policy",
  "server",
  "x-powered-by",
  "cache-control",
  "permissions-policy",
]);

export function HeadersSection({ data }: { data?: HttpHeader[] | null }) {
  return (
    <Section {...sections.headers}>
      {data && data.length > 0 ? (
        <KeyValueGrid colsDesktop={2}>
          {data.map((h, index) => (
            <KeyValue
              key={`header-${h.name}-${index}`}
              label={h.name}
              value={h.value}
              copyable
              highlight={IMPORTANT_HEADERS.has(h.name)}
            />
          ))}
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

import { ExternalLink, Info, Logs, Search } from "lucide-react";
import Link from "next/link";
import { KeyValue } from "@/components/domain/key-value";
import { KeyValueGrid } from "@/components/domain/key-value-grid";
import { ReportSection } from "@/components/domain/report-section";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { IMPORTANT_HEADERS } from "@/lib/constants/headers";
import { sections } from "@/lib/constants/sections";
import { normalizeDomainInput } from "@/lib/domain";
import type { HeadersResponse } from "@/lib/schemas";

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
  data?: HeadersResponse | null;
}) {
  const headers = data?.headers?.filter((h) => h.value.trim() !== "") ?? [];
  const status = data?.status;
  const statusMessage = data?.statusMessage;

  if (status === 0 && statusMessage === "Invalid SSL certificate") {
    return null;
  }

  return (
    <ReportSection {...sections.headers}>
      {headers && headers.length > 0 ? (
        <div className="space-y-4">
          {status !== 200 && (
            <Alert>
              <Info aria-hidden="true" />
              <AlertDescription>
                <p className="text-[13px]">
                  Server returned{" "}
                  <a
                    href={`https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Status/${status}`}
                    target="_blank"
                    rel="noopener"
                    className="inline-flex items-center gap-1 text-foreground/90 underline underline-offset-3 hover:text-muted-foreground"
                  >
                    <span className="font-medium">
                      {status}
                      {statusMessage ? ` ${statusMessage}` : ""}
                    </span>
                    <ExternalLink
                      className="!h-3.5 !w-3.5"
                      aria-hidden="true"
                    />
                  </a>
                  {"."}
                </p>
              </AlertDescription>
            </Alert>
          )}

          <KeyValueGrid colsDesktop={2}>
            {headers.map((h) => {
              const isLocation = h.name?.toLowerCase() === "location";
              const locationDomain = isLocation
                ? extractDomainFromLocation(h.value)
                : null;

              return (
                <KeyValue
                  key={`header-${h.name}-${h.value}`}
                  label={h.name}
                  value={h.value}
                  copyable
                  highlight={IMPORTANT_HEADERS.has(h.name?.toLowerCase() ?? "")}
                  suffix={
                    locationDomain ? (
                      <Link
                        href={`/${encodeURIComponent(locationDomain)}`}
                        prefetch={false}
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
        </div>
      ) : (
        <div className="space-y-4">
          {status === 0 && statusMessage ? (
            <Alert variant="destructive">
              <Info className="h-4 w-4" />
              <AlertDescription>{statusMessage}</AlertDescription>
            </Alert>
          ) : null}
          <Empty className="border border-dashed">
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <Logs />
              </EmptyMedia>
              <EmptyTitle>No HTTP headers detected</EmptyTitle>
              <EmptyDescription>
                We couldn&apos;t fetch any HTTP response headers for this site.
                It may be offline or blocking requests.
              </EmptyDescription>
            </EmptyHeader>
          </Empty>
        </div>
      )}
    </ReportSection>
  );
}

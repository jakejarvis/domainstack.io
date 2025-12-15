import { format } from "date-fns";
import { BadgeCheck } from "lucide-react";
import { Favicon } from "@/components/domain/favicon";
import { Spinner } from "@/components/ui/spinner";
import type { DnsRecordForTooltip } from "@/lib/db/repos/tracked-domains";
import type { ProviderCategory } from "@/lib/schemas";

type ProviderTooltipContentProps = {
  providerName: string;
  providerDomain: string | null;
  providerType?: ProviderCategory;
  isLoading: boolean;
  records?: DnsRecordForTooltip[];
  certificateExpiryDate?: Date | null;
  whoisServer?: string | null;
  rdapServers?: string[] | null;
  registrationSource?: "rdap" | "whois" | null;
};

/**
 * Extract domain from URL or hostname string
 */
function extractDomain(input: string | undefined | null): string | undefined {
  if (!input) return undefined;
  const value = String(input).trim();
  if (!value) return undefined;
  try {
    const url = new URL(value.includes("://") ? value : `https://${value}`);
    return url.hostname || undefined;
  } catch {
    return undefined;
  }
}

/**
 * Renders the content inside a provider tooltip.
 * Shows DNS records for DNS/hosting/email providers,
 * certificate expiry for CA providers,
 * registrar verification info for registrars,
 * or loading/empty states.
 */
export function ProviderTooltipContent({
  providerName,
  providerDomain,
  providerType,
  isLoading,
  records,
  certificateExpiryDate,
  whoisServer,
  rdapServers,
  registrationSource,
}: ProviderTooltipContentProps) {
  const hasRecords = records && records.length > 0;
  const hasCertificateExpiry = certificateExpiryDate != null;
  const hasRegistrationInfo = whoisServer != null || rdapServers != null;

  return (
    <div className="space-y-2 py-1">
      {/* Provider info */}
      <div className="flex items-center gap-2 border-border/20 border-b pb-2">
        {providerDomain && (
          <Favicon
            domain={providerDomain}
            size={16}
            className="shrink-0 rounded"
          />
        )}
        <span className="font-medium">{providerName}</span>
      </div>

      {/* Loading state */}
      {isLoading ? (
        <div className="flex items-center justify-center gap-2 py-1 text-muted/90 text-xs">
          <Spinner className="size-3" />
          <span>Loading…</span>
        </div>
      ) : providerType === "registrar" ? (
        // Registrar verification info (WHOIS/RDAP)
        hasRegistrationInfo ? (
          <div className="text-xs">
            {(() => {
              const serverUrl =
                rdapServers && rdapServers.length > 0
                  ? rdapServers[rdapServers.length - 1]
                  : undefined;
              const serverName = serverUrl
                ? (extractDomain(serverUrl) ?? "RDAP")
                : (whoisServer ?? "WHOIS");
              const learnUrl =
                registrationSource === "rdap"
                  ? "https://about.rdap.org/"
                  : "https://en.wikipedia.org/wiki/WHOIS";

              return (
                <p className="inline-flex items-center gap-1">
                  <BadgeCheck className="!h-3.5 !w-3.5 text-green-300 dark:text-green-600" />
                  <span>
                    Verified by{" "}
                    <span className="font-medium">
                      {serverUrl ? (
                        <a
                          href={serverUrl}
                          target="_blank"
                          rel="noopener"
                          className="underline underline-offset-2"
                        >
                          {serverName}
                        </a>
                      ) : (
                        serverName
                      )}
                    </span>{" "}
                    <a
                      href={learnUrl}
                      target="_blank"
                      rel="noopener"
                      title={`Learn about ${registrationSource === "rdap" ? "RDAP" : "WHOIS"}`}
                      className=""
                    >
                      <span className="text-muted/75">(</span>
                      <span className="text-muted/90 underline decoration-dotted underline-offset-2">
                        {registrationSource === "rdap" ? "RDAP" : "WHOIS"}
                      </span>
                      <span className="text-muted/75">)</span>
                    </a>
                  </span>
                </p>
              );
            })()}
          </div>
        ) : (
          <div className="py-1 text-muted/80 text-xs">
            No registration data available
          </div>
        )
      ) : providerType === "ca" ? (
        // Certificate expiry for CA providers
        hasCertificateExpiry ? (
          <div className="text-xs">
            Expires on {format(certificateExpiryDate, "MMM d, yyyy")}
          </div>
        ) : (
          <div className="py-1 text-muted/80 text-xs">
            No certificate data available
          </div>
        )
      ) : // DNS records for other providers
      hasRecords ? (
        <div className="space-y-1">
          {records.map((record) => (
            <div key={record.value} className="font-mono text-xs">
              {record.priority != null
                ? `${record.priority} ${record.value}`
                : record.value}
            </div>
          ))}
        </div>
      ) : (
        <div className="py-1 text-muted/80 text-xs">
          No DNS records available
        </div>
      )}
    </div>
  );
}

import { format } from "date-fns";
import { BadgeCheck, HatGlasses, Lock, LockOpen } from "lucide-react";
import { formatRegistrant } from "@/components/domain/registration/registration-section";
import { ProviderIcon } from "@/components/icons/provider-icon";
import { Spinner } from "@/components/ui/spinner";
import type { DnsRecordForTooltip } from "@/lib/db/repos/tracked-domains";
import type { ProviderCategory, RegistrationContacts } from "@/lib/schemas";

type ProviderTooltipContentProps = {
  providerId?: string | null;
  providerName: string;
  providerDomain: string | null;
  providerType?: ProviderCategory;
  isLoading: boolean;
  records?: DnsRecordForTooltip[];
  certificateExpiryDate?: Date | null;
  whoisServer?: string | null;
  rdapServers?: string[] | null;
  registrationSource?: "rdap" | "whois" | null;
  transferLock?: boolean | null;
  registrantInfo?: {
    privacyEnabled: boolean | null;
    contacts: unknown;
  };
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
  providerId,
  providerName,
  providerDomain,
  providerType,
  isLoading,
  records,
  certificateExpiryDate,
  whoisServer,
  rdapServers,
  registrationSource,
  transferLock,
  registrantInfo,
}: ProviderTooltipContentProps) {
  const hasRecords = records && records.length > 0;
  const hasCertificateExpiry = certificateExpiryDate != null;
  const hasRegistrationInfo = whoisServer != null || rdapServers != null;

  // Extract registrant details for display
  const registrant =
    registrantInfo?.contacts && !registrantInfo.privacyEnabled
      ? (() => {
          const contacts = registrantInfo.contacts as RegistrationContacts;
          const registrantContact = contacts.find(
            (c) => c.type === "registrant",
          );
          if (!registrantContact) return null;
          const organization =
            (
              registrantContact.organization ||
              registrantContact.name ||
              ""
            ).trim() || "Unknown";
          const country =
            registrantContact.country || registrantContact.countryCode || "";
          const state = registrantContact.state || undefined;
          return { organization, country, state };
        })()
      : null;

  // Extract registration verification details
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
    <div className="space-y-2 py-1">
      {/* Provider info */}
      <div className="flex items-center gap-2 border-border/20 border-b pb-2">
        {providerId && (
          <ProviderIcon
            providerId={providerId}
            providerName={providerName}
            providerDomain={providerDomain}
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
        // Registrar verification info (WHOIS/RDAP) and registrant details
        hasRegistrationInfo ? (
          <div className="space-y-1.5 text-xs">
            {/* Registrant info */}
            {registrantInfo && (
              <div className="flex items-center gap-1.5">
                {registrantInfo.privacyEnabled || !registrant ? (
                  <>
                    <HatGlasses className="size-3.5 text-muted" />
                    <span className="text-background/90">Privacy enabled</span>
                  </>
                ) : (
                  <span className="text-background/90">
                    {formatRegistrant(registrant)}
                  </span>
                )}
              </div>
            )}

            {/* Transfer Lock */}
            {transferLock !== null && transferLock !== undefined && (
              <div className="flex items-center gap-1.5">
                {transferLock ? (
                  <>
                    <Lock className="size-3.5 text-muted" />
                    <span className="text-background/90">
                      Transfer lock is on
                    </span>
                  </>
                ) : (
                  <>
                    <LockOpen className="size-3.5 text-amber-300 dark:text-amber-500" />
                    <span className="text-background/90">
                      Transfer lock is off
                    </span>
                  </>
                )}
              </div>
            )}

            {/* Verification source */}
            <div className="flex items-center gap-1.5">
              <BadgeCheck className="size-3.5 text-green-300 dark:text-green-600" />
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
                >
                  <span className="text-muted/75">(</span>
                  <span className="text-muted/90 underline decoration-dotted underline-offset-2">
                    {registrationSource === "rdap" ? "RDAP" : "WHOIS"}
                  </span>
                  <span className="text-muted/75">)</span>
                </a>
              </span>
            </div>
          </div>
        ) : (
          <div className="text-muted/80 text-xs">
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
          <div className="text-muted/80 text-xs">
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
        <div className="text-muted/80 text-xs">No DNS records available</div>
      )}
    </div>
  );
}

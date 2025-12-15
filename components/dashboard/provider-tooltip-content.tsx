import { format } from "date-fns";
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
};

/**
 * Renders the content inside a provider tooltip.
 * Shows DNS records for DNS/hosting/email providers,
 * certificate expiry for CA providers,
 * or loading/empty states.
 */
export function ProviderTooltipContent({
  providerName,
  providerDomain,
  providerType,
  isLoading,
  records,
  certificateExpiryDate,
}: ProviderTooltipContentProps) {
  const hasRecords = records && records.length > 0;
  const hasCertificateExpiry = certificateExpiryDate != null;

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
      ) : providerType === "ca" ? (
        // Certificate expiry for CA providers
        hasCertificateExpiry ? (
          <div className="text-xs">
            <span>Expires on</span>{" "}
            <span className="font-medium">
              {format(certificateExpiryDate, "MMM d, yyyy")}
            </span>
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

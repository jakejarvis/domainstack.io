import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import type {
  DnsRecordForTooltip,
  ProviderInfo,
} from "@/lib/db/repos/tracked-domains";
import type { ProviderCategory } from "@/lib/schemas";
import { useTRPC } from "@/lib/trpc/client";

type UseProviderTooltipDataParams = {
  provider: ProviderInfo;
  trackedDomainId?: string;
  providerType?: ProviderCategory;
};

type ProviderTooltipData = {
  isOpen: boolean;
  setIsOpen: (open: boolean) => void;
  shouldShowTooltip: boolean;
  isLoading: boolean;
  records?: DnsRecordForTooltip[];
  certificateExpiryDate?: Date | null;
};

/**
 * Hook to manage provider tooltip data including lazy loading DNS records
 * and certificate expiry dates.
 *
 * @param provider - Provider information
 * @param trackedDomainId - Optional tracked domain ID for lazy loading
 * @param providerType - Provider category (dns, hosting, email, ca, registrar)
 * @returns Tooltip state and data for rendering
 */
export function useProviderTooltipData({
  provider,
  trackedDomainId,
  providerType,
}: UseProviderTooltipDataParams): ProviderTooltipData {
  const trpc = useTRPC();
  const [isOpen, setIsOpen] = useState(false);

  const hasRecords = provider.records && provider.records.length > 0;
  const hasCertificateExpiry = provider.certificateExpiryDate != null;

  // Only lazy-load data for DNS, hosting, email, and CA providers (not registrars)
  const shouldLazyLoad =
    !!trackedDomainId &&
    !!providerType &&
    providerType !== "registrar" &&
    ((providerType === "ca" && !hasCertificateExpiry) ||
      (providerType !== "ca" && !hasRecords));

  // Lazy load domain details when tooltip opens (only if needed)
  const { data: domainDetails, isLoading } = useQuery(
    trpc.tracking.getDomainDetails.queryOptions(
      {
        trackedDomainId: trackedDomainId ?? "",
      },
      {
        enabled: shouldLazyLoad && isOpen,
        staleTime: 60_000, // Cache for 1 minute
      },
    ),
  );

  // Extract records/certificate data from lazy-loaded details
  let lazyLoadedRecords: DnsRecordForTooltip[] | undefined;
  let lazyLoadedCertificateExpiry: Date | null | undefined;
  if (domainDetails && providerType) {
    if (providerType === "ca") {
      lazyLoadedCertificateExpiry = domainDetails.ca?.certificateExpiryDate;
    } else {
      lazyLoadedRecords = domainDetails[providerType]?.records;
    }
  }

  const displayRecords = provider.records ?? lazyLoadedRecords;
  const displayCertificateExpiry =
    provider.certificateExpiryDate ?? lazyLoadedCertificateExpiry;

  const hasDisplayRecords = displayRecords && displayRecords.length > 0;
  const hasDisplayCertificateExpiry = displayCertificateExpiry != null;

  const shouldShowTooltip =
    hasDisplayRecords || hasDisplayCertificateExpiry || shouldLazyLoad;

  return {
    isOpen,
    setIsOpen,
    shouldShowTooltip,
    isLoading,
    records: displayRecords,
    certificateExpiryDate: displayCertificateExpiry,
  };
}

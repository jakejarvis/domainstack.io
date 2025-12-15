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
  whoisServer?: string | null;
  rdapServers?: string[] | null;
  registrationSource?: "rdap" | "whois" | null;
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
  const hasRegistrationInfo =
    provider.whoisServer != null || provider.rdapServers != null;

  // Helper to check if provider is missing expected data
  const isMissingData = (): boolean => {
    if (!providerType) return false;

    switch (providerType) {
      case "ca":
        return !hasCertificateExpiry;
      case "registrar":
        return !hasRegistrationInfo;
      case "dns":
      case "hosting":
      case "email":
        return !hasRecords;
      default:
        return false;
    }
  };

  // Determine if we should lazy-load based on provider type
  const shouldLazyLoad = !!trackedDomainId && isMissingData();

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

  // Extract records/certificate/registration data from lazy-loaded details
  let lazyLoadedRecords: DnsRecordForTooltip[] | undefined;
  let lazyLoadedCertificateExpiry: Date | null | undefined;
  let lazyLoadedWhoisServer: string | null | undefined;
  let lazyLoadedRdapServers: string[] | null | undefined;
  let lazyLoadedRegistrationSource: "rdap" | "whois" | null | undefined;

  if (domainDetails && providerType) {
    if (providerType === "ca") {
      lazyLoadedCertificateExpiry = domainDetails.ca?.certificateExpiryDate;
    } else if (providerType === "registrar") {
      lazyLoadedWhoisServer = domainDetails.registrar?.whoisServer;
      lazyLoadedRdapServers = domainDetails.registrar?.rdapServers;
      lazyLoadedRegistrationSource =
        domainDetails.registrar?.registrationSource;
    } else {
      lazyLoadedRecords = domainDetails[providerType]?.records;
    }
  }

  const displayRecords = provider.records ?? lazyLoadedRecords;
  const displayCertificateExpiry =
    provider.certificateExpiryDate ?? lazyLoadedCertificateExpiry;
  const displayWhoisServer = provider.whoisServer ?? lazyLoadedWhoisServer;
  const displayRdapServers = provider.rdapServers ?? lazyLoadedRdapServers;
  const displayRegistrationSource =
    provider.registrationSource ?? lazyLoadedRegistrationSource;

  const hasDisplayRecords = displayRecords && displayRecords.length > 0;
  const hasDisplayCertificateExpiry = displayCertificateExpiry != null;
  const hasDisplayRegistrationInfo =
    displayWhoisServer != null || displayRdapServers != null;

  const shouldShowTooltip =
    hasDisplayRecords ||
    hasDisplayCertificateExpiry ||
    hasDisplayRegistrationInfo ||
    shouldLazyLoad;

  return {
    isOpen,
    setIsOpen,
    shouldShowTooltip,
    isLoading,
    records: displayRecords,
    certificateExpiryDate: displayCertificateExpiry,
    whoisServer: displayWhoisServer,
    rdapServers: displayRdapServers,
    registrationSource: displayRegistrationSource,
  };
}

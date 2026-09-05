import { skipToken, useQuery } from "@tanstack/react-query";
import { useState } from "react";

import { useTRPC } from "@/lib/trpc/client";
import type {
  DnsRecord,
  ProviderCategory,
  ProviderInfo,
  RegistrationContact,
  RegistrationSource,
} from "@domainstack/types";

interface UseProviderTooltipDataParams {
  provider: ProviderInfo;
  trackedDomainId?: string;
  providerType?: ProviderCategory;
}

interface ProviderTooltipData {
  isOpen: boolean;
  setIsOpen: (open: boolean) => void;
  shouldShowTooltip: boolean;
  isLoading: boolean;
  providerId?: string | null;
  records?: DnsRecord[];
  certificateExpiryDate?: Date | null;
  whoisServer?: string | null;
  rdapServers?: string[] | null;
  registrationSource?: RegistrationSource | null;
  transferLock?: boolean | null;
  registrantInfo?: {
    privacyEnabled: boolean | null;
    contacts: RegistrationContact[] | null;
  };
}

type LazyLoadedProviderDetails = {
  records?: DnsRecord[];
  certificateExpiryDate?: Date | null;
  whoisServer?: string | null;
  rdapServers?: string[] | null;
  registrationSource?: RegistrationSource | null;
  transferLock?: boolean | null;
  registrantInfo?: {
    privacyEnabled: boolean | null;
    contacts: RegistrationContact[] | null;
  };
};

type DomainDetailsForTooltip = {
  ca?: { certificateExpiryDate?: Date | null } | null;
  registrar?: LazyLoadedProviderDetails | null;
  dns?: { records?: DnsRecord[] } | null;
  hosting?: { records?: DnsRecord[] } | null;
  email?: { records?: DnsRecord[] } | null;
};

function isProviderMissingData({
  providerType,
  hasRecords,
  hasCertificateExpiry,
  hasRegistrationInfo,
}: {
  providerType?: ProviderCategory;
  hasRecords: boolean | undefined;
  hasCertificateExpiry: boolean;
  hasRegistrationInfo: boolean;
}): boolean {
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
}

function extractLazyLoadedProviderDetails(
  domainDetails: DomainDetailsForTooltip | undefined,
  providerType?: ProviderCategory,
): LazyLoadedProviderDetails {
  if (!domainDetails || !providerType) return {};

  if (providerType === "ca") {
    return { certificateExpiryDate: domainDetails.ca?.certificateExpiryDate };
  }

  if (providerType === "registrar") {
    const registrar = domainDetails.registrar;
    return {
      whoisServer: registrar?.whoisServer,
      rdapServers: registrar?.rdapServers,
      registrationSource: registrar?.registrationSource,
      transferLock: registrar?.transferLock,
      registrantInfo: registrar?.registrantInfo,
    };
  }

  return { records: domainDetails[providerType]?.records };
}

function mergeProviderTooltipData(
  provider: ProviderInfo,
  lazyLoaded: LazyLoadedProviderDetails,
  shouldLazyLoad: boolean,
) {
  const records = provider.records ?? lazyLoaded.records;
  const certificateExpiryDate = provider.certificateExpiryDate ?? lazyLoaded.certificateExpiryDate;
  const whoisServer = provider.whoisServer ?? lazyLoaded.whoisServer;
  const rdapServers = provider.rdapServers ?? lazyLoaded.rdapServers;
  const registrationSource = provider.registrationSource ?? lazyLoaded.registrationSource;
  const transferLock = provider.transferLock ?? lazyLoaded.transferLock;
  const registrantInfo = provider.registrantInfo ?? lazyLoaded.registrantInfo;
  const hasDisplayData = Boolean(
    records?.length || certificateExpiryDate != null || whoisServer != null || rdapServers != null,
  );

  return {
    records,
    certificateExpiryDate,
    whoisServer,
    rdapServers,
    registrationSource,
    transferLock,
    registrantInfo,
    shouldShowTooltip: hasDisplayData || shouldLazyLoad,
  };
}

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

  const shouldLazyLoad =
    !!trackedDomainId &&
    isProviderMissingData({
      providerType,
      hasRecords: Boolean(provider.records && provider.records.length > 0),
      hasCertificateExpiry: provider.certificateExpiryDate != null,
      hasRegistrationInfo: provider.whoisServer != null || provider.rdapServers != null,
    });

  const { data: domainDetails, isLoading } = useQuery(
    trpc.tracking.getDomainDetails.queryOptions(
      shouldLazyLoad && isOpen && trackedDomainId ? { trackedDomainId } : skipToken,
      { staleTime: 60_000 },
    ),
  );

  const merged = mergeProviderTooltipData(
    provider,
    extractLazyLoadedProviderDetails(domainDetails, providerType),
    shouldLazyLoad,
  );

  return {
    isOpen,
    setIsOpen,
    shouldShowTooltip: merged.shouldShowTooltip,
    isLoading,
    providerId: provider.id,
    records: merged.records,
    certificateExpiryDate: merged.certificateExpiryDate,
    whoisServer: merged.whoisServer,
    rdapServers: merged.rdapServers,
    registrationSource: merged.registrationSource,
    transferLock: merged.transferLock,
    registrantInfo: merged.registrantInfo,
  };
}

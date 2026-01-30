import { useCachedPromise } from "@raycast/utils";
import {
  getCertificates,
  getDnsRecords,
  getHeaders,
  getHosting,
  getRegistration,
  getSeo,
} from "../api/domainstack";
import type { DomainLookupResult } from "../utils/types";

/**
 * Fetch all domain data in parallel.
 */
async function fetchAllDomainData(domain: string): Promise<DomainLookupResult> {
  const [registration, dns, hosting, certificates, headers, seo] =
    await Promise.allSettled([
      getRegistration(domain),
      getDnsRecords(domain),
      getHosting(domain),
      getCertificates(domain),
      getHeaders(domain),
      getSeo(domain),
    ]);

  return {
    registration:
      registration.status === "fulfilled" ? registration.value : null,
    dns: dns.status === "fulfilled" ? dns.value : null,
    hosting: hosting.status === "fulfilled" ? hosting.value : null,
    certificates:
      certificates.status === "fulfilled" ? certificates.value : null,
    headers: headers.status === "fulfilled" ? headers.value : null,
    seo: seo.status === "fulfilled" ? seo.value : null,
  };
}

interface UseDomainLookupOptions {
  domain: string | null;
}

interface UseDomainLookupResult {
  data: DomainLookupResult | undefined;
  isLoading: boolean;
  error: Error | undefined;
  revalidate: () => void;
}

/**
 * Hook to fetch domain lookup data with caching.
 */
export function useDomainLookup({
  domain,
}: UseDomainLookupOptions): UseDomainLookupResult {
  const result = useCachedPromise(
    async (d: string) => fetchAllDomainData(d),
    [domain ?? ""],
    {
      execute: !!domain,
      keepPreviousData: true,
    },
  );

  return {
    data: result.data,
    isLoading: result.isLoading,
    error:
      result.error instanceof Error
        ? result.error
        : result.error
          ? new Error(String(result.error))
          : undefined,
    revalidate: result.revalidate,
  };
}

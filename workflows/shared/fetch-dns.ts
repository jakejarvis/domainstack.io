import type { DnsRecordsResponse } from "@/lib/types/domain/dns";

export interface FetchDnsStepResult {
  success: boolean;
  data: DnsRecordsResponse | null;
  error?: string;
}

/**
 * Shared step: Fetch and persist DNS records for a domain.
 *
 * This step can be called from any workflow to fetch DNS data
 * with full durability and retry semantics.
 */
export async function fetchDnsData(
  domain: string,
): Promise<FetchDnsStepResult> {
  "use step";

  const { lookupAndPersistDns } = await import("@/lib/domain/dns-lookup");

  const result = await lookupAndPersistDns(domain);

  if (!result) {
    return { success: false, data: null, error: "All DoH providers failed" };
  }

  return {
    success: true,
    data: result,
  };
}

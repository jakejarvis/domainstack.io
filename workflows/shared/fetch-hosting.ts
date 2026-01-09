import type { DnsRecord, Header, HostingResponse } from "@/lib/types";

export interface FetchHostingResult {
  success: boolean;
  data: HostingResponse | null;
  error?: string;
}

/**
 * Shared step: Compute and persist hosting/email/DNS providers for a domain.
 *
 * This step requires DNS records and headers from previous fetch steps.
 * It can be called from any workflow to detect hosting providers
 * with full durability and retry semantics.
 */
export async function fetchHostingData(
  domain: string,
  dnsRecords: DnsRecord[],
  headers: Header[],
): Promise<FetchHostingResult> {
  "use step";

  const { lookupAndPersistHosting } = await import(
    "@/lib/domain/hosting-lookup"
  );

  try {
    const result = await lookupAndPersistHosting(domain, dnsRecords, headers);
    return { success: true, data: result };
  } catch (err) {
    return {
      success: false,
      data: null,
      error: String(err),
    };
  }
}

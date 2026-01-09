import type { HeadersResponse } from "@/lib/types";

export interface FetchHeadersResult {
  success: boolean;
  data: HeadersResponse;
  error?: string;
}

/**
 * Shared step: Fetch and persist HTTP headers for a domain.
 *
 * This step can be called from any workflow to fetch headers data
 * with full durability and retry semantics.
 */
export async function fetchHeadersData(
  domain: string,
): Promise<FetchHeadersResult> {
  "use step";

  const { lookupAndPersistHeaders } = await import(
    "@/lib/domain/headers-lookup"
  );

  const result = await lookupAndPersistHeaders(domain);

  if (!result) {
    return {
      success: false,
      data: { headers: [], status: 0 },
      error: "Headers fetch failed",
    };
  }

  return {
    success: true,
    data: result,
  };
}

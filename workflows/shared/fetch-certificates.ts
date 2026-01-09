import type { CertificatesResponse } from "@/lib/types";

export interface FetchCertificatesResult {
  success: boolean;
  data: CertificatesResponse | null;
  error?: string;
}

/**
 * Shared step: Fetch and persist TLS certificates for a domain.
 *
 * This step can be called from any workflow to fetch certificate data
 * with full durability and retry semantics.
 */
export async function fetchCertificatesData(
  domain: string,
): Promise<FetchCertificatesResult> {
  "use step";

  const { lookupAndPersistCertificates } = await import(
    "@/lib/domain/certificates-lookup"
  );

  const result = await lookupAndPersistCertificates(domain);

  if (!result) {
    return {
      success: false,
      data: { certificates: [] },
      error: "Certificate fetch failed",
    };
  }

  return {
    success: true,
    data: result,
  };
}

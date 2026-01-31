/**
 * Certificates service - fetches and persists TLS certificates.
 *
 * Replaces the workflow-based implementation with a simple async function.
 * Transient errors throw (for TanStack Query to retry).
 * Permanent errors return { success: false, error }.
 */

import type { RawCertificate } from "@domainstack/core/tls";
import type { Certificate, CertificatesResponse } from "@domainstack/types";
import { ttlForCertificates } from "../ttl";

// ============================================================================
// Types
// ============================================================================

export type CertificatesError = "dns_error" | "tls_error";

export type CertificatesResult =
  | { success: true; data: CertificatesResponse }
  | { success: false; error: CertificatesError };

interface CertificatesProcessedData {
  certificates: Certificate[];
  providerIds: (string | null)[];
  earliestValidTo: Date;
}

// ============================================================================
// Main Service Function
// ============================================================================

/**
 * Fetch and persist TLS certificates for a domain.
 *
 * @param domain - The domain to probe
 * @returns Certificates result with data or error
 *
 * @throws Error on transient failures (timeout, fetch_error) - TanStack Query retries these
 */
export async function fetchCertificates(
  domain: string,
): Promise<CertificatesResult> {
  // 1. Fetch certificate chain via TLS handshake
  const fetchResult = await fetchCertificateChainInternal(domain);

  if (!fetchResult.success) {
    return { success: false, error: fetchResult.error };
  }

  // 2. Detect CA providers and build response
  const processedData = await processChain(fetchResult.chain);

  // 3. Persist to database
  await persistCertificates(domain, processedData);

  return {
    success: true,
    data: { certificates: processedData.certificates },
  };
}

// ============================================================================
// Internal: Fetch Certificate Chain
// ============================================================================

type FetchResult =
  | { success: true; chain: RawCertificate[] }
  | { success: false; error: CertificatesError };

async function fetchCertificateChainInternal(
  domain: string,
): Promise<FetchResult> {
  const { fetchCertificateChain } = await import("@domainstack/core/tls");

  const result = await fetchCertificateChain(domain);

  if (!result.success) {
    // Transient failures - throw for TanStack Query to retry
    if (result.error === "fetch_error" || result.error === "timeout") {
      throw new Error("Certificate fetch failed");
    }

    // Permanent failures (dns_error, tls_error) - return error result
    return { success: false, error: result.error };
  }

  return {
    success: true,
    chain: result.chain,
  };
}

// ============================================================================
// Internal: Process Chain
// ============================================================================

async function processChain(
  chain: RawCertificate[],
): Promise<CertificatesProcessedData> {
  const { getProviderCatalog } = await import("../edge-config");
  const { detectCertificateAuthority, getProvidersFromCatalog } = await import(
    "@domainstack/core/providers"
  );
  const { upsertCatalogProvider } = await import("@domainstack/db/queries");

  const catalog = await getProviderCatalog();
  const caProviders = catalog ? getProvidersFromCatalog(catalog, "ca") : [];

  // Detect providers and upsert to get IDs
  const certificatesWithMatches = chain.map((c) => {
    const matched = detectCertificateAuthority(c.issuer, caProviders);
    return {
      cert: {
        issuer: c.issuer,
        subject: c.subject,
        altNames: c.altNames,
        validFrom: c.validFrom,
        validTo: c.validTo,
        caProvider: {
          id: null,
          name: matched?.name ?? null,
          domain: matched?.domain ?? null,
        },
      },
      catalogProvider: matched,
    };
  });

  // Upsert catalog providers and get IDs
  const providerIds = await Promise.all(
    certificatesWithMatches.map(async ({ catalogProvider }) => {
      if (catalogProvider) {
        const ref = await upsertCatalogProvider(catalogProvider);
        return ref.id;
      }
      return null;
    }),
  );

  // Update certificates with provider IDs
  const certificates: Certificate[] = certificatesWithMatches.map(
    ({ cert }, i) => ({
      ...cert,
      caProvider: {
        ...cert.caProvider,
        id: providerIds[i],
      },
    }),
  );

  const earliestValidTo =
    certificates.length > 0
      ? new Date(
          Math.min(...certificates.map((c) => new Date(c.validTo).getTime())),
        )
      : new Date(Date.now() + 3_600_000);

  return { certificates, providerIds, earliestValidTo };
}

// ============================================================================
// Internal: Persist Certificates
// ============================================================================

async function persistCertificates(
  domain: string,
  processedData: CertificatesProcessedData,
): Promise<void> {
  const { ensureDomainRecord, replaceCertificates } = await import(
    "@domainstack/db/queries"
  );

  const now = new Date();
  const expiresAt = ttlForCertificates(now, processedData.earliestValidTo);

  const domainRecord = await ensureDomainRecord(domain);

  const chainWithIds = processedData.certificates.map((c, i) => ({
    issuer: c.issuer,
    subject: c.subject,
    altNames: c.altNames,
    validFrom: new Date(c.validFrom),
    validTo: new Date(c.validTo),
    caProviderId: processedData.providerIds[i],
  }));

  await replaceCertificates({
    domainId: domainRecord.id,
    chain: chainWithIds,
    fetchedAt: now,
    expiresAt,
  });
}

/**
 * Certificates fetch step.
 *
 * Fetches TLS certificate chain from a domain via TLS handshake.
 * Unreachable hosts and handshake failures are returned as typed results
 * so tracking workflows can continue without certificate data.
 */

import type { RawCertificate } from "@domainstack/server/tls";
import type { Certificate } from "@domainstack/types";

import type {
  CertificatesFetchData,
  CertificatesProcessedData,
  FetchCertificatesResult,
} from "./types";

/**
 * Step: Fetch certificate chain via TLS handshake.
 *
 * DNS, TLS, timeout, and unreachable-host errors are returned as typed
 * results so tracking workflows can continue without certificate data.
 *
 * @param domain - The domain to connect to
 * @returns FetchCertificatesResult with typed error on failure
 */
export async function fetchCertificateChainStep(domain: string): Promise<FetchCertificatesResult> {
  "use step";

  // Dynamic import to keep step bundle small
  const { fetchCertificateChain } = await import("@domainstack/server/tls");

  const result = await fetchCertificateChain(domain);

  if (!result.success) {
    return { success: false, error: result.error };
  }

  return {
    success: true,
    data: {
      chainJson: JSON.stringify(result.chain),
      valid: result.valid,
      validationError: result.validationError,
      protocol: result.protocol,
      cipher: result.cipher,
      publicKeyBits: result.publicKeyBits,
      chainComplete: result.chainComplete,
    },
  };
}

/**
 * Step: Detect CA providers from issuer names and build response.
 *
 * @param fetchData - Serialized chain plus TLS observation
 * @returns Processed certificates with provider IDs and expiry metadata
 */
export async function processChainStep(
  fetchData: CertificatesFetchData,
): Promise<CertificatesProcessedData> {
  "use step";

  // Dynamic imports to avoid top-level db/network dependencies
  const { getProviderCatalog } = await import("@domainstack/edge-config");
  const { detectCertificateAuthority, getProvidersFromCatalog } =
    await import("@domainstack/utils/providers");
  const { upsertCatalogProvider } = await import("@domainstack/db/queries/providers");

  const chain = JSON.parse(fetchData.chainJson) as RawCertificate[];
  const catalog = await getProviderCatalog();
  const caProviders = catalog ? getProvidersFromCatalog(catalog, "ca") : [];

  const certificatesWithMatches = chain.map((c) => {
    const matched = detectCertificateAuthority(c.issuer, caProviders);
    return {
      cert: {
        issuer: c.issuer,
        subject: c.subject,
        altNames: c.altNames,
        validFrom: c.validFrom,
        validTo: c.validTo,
        fingerprint256: c.fingerprint256 || null,
        serialNumber: c.serialNumber || null,
        chainPosition: c.chainPosition,
        caProvider: {
          id: null,
          name: matched?.name ?? null,
          domain: matched?.domain ?? null,
        },
      },
      catalogProvider: matched,
    };
  });

  const providerIds = await Promise.all(
    certificatesWithMatches.map(async ({ catalogProvider }) => {
      if (catalogProvider) {
        const ref = await upsertCatalogProvider(catalogProvider);
        return ref.id;
      }
      return null;
    }),
  );

  const certificates: Certificate[] = certificatesWithMatches.map(({ cert }, i) => ({
    issuer: cert.issuer,
    subject: cert.subject,
    altNames: cert.altNames,
    validFrom: cert.validFrom,
    validTo: cert.validTo,
    fingerprint256: cert.fingerprint256,
    serialNumber: cert.serialNumber,
    chainPosition: cert.chainPosition,
    caProvider: {
      id: providerIds[i],
      name: cert.caProvider.name,
      domain: cert.caProvider.domain,
    },
  }));

  const earliestValidTo =
    certificates.length > 0
      ? new Date(Math.min(...certificates.map((c) => new Date(c.validTo).getTime())))
      : new Date(Date.now() + 3_600_000);

  return {
    certificates,
    providerIds,
    earliestValidTo,
    valid: fetchData.valid,
    validationError: fetchData.validationError,
    protocol: fetchData.protocol,
    cipher: fetchData.cipher,
    publicKeyBits: fetchData.publicKeyBits,
    chainComplete: fetchData.chainComplete,
  };
}

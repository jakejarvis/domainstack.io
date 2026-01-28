/**
 * Certificates fetch step.
 *
 * Fetches TLS certificate chain from a domain via TLS handshake.
 * This step is shared between the dedicated certificatesWorkflow and internal workflows.
 */

import type { RawCertificate } from "@domainstack/core/tls";
import type { Certificate } from "@domainstack/types";
import { RetryableError } from "workflow";
import type {
  CertificatesProcessedData,
  FetchCertificatesResult,
} from "./types";

/**
 * Step: Fetch certificate chain via TLS handshake.
 *
 * DNS and TLS errors are permanent failures.
 * fetch_error and timeout are thrown as RetryableError for automatic retry.
 *
 * @param domain - The domain to connect to
 * @returns FetchCertificatesResult with typed error on failure
 */
export async function fetchCertificateChainStep(
  domain: string,
): Promise<FetchCertificatesResult> {
  "use step";

  // Dynamic import to keep step bundle small
  const { fetchCertificateChain } = await import("@domainstack/core/tls");

  const result = await fetchCertificateChain(domain);

  if (!result.success) {
    // fetch_error and timeout trigger workflow retries
    if (result.error === "fetch_error" || result.error === "timeout") {
      throw new RetryableError("Certificate fetch failed", {
        retryAfter: "5s",
      });
    }

    // Permanent failures (dns_error, tls_error) - return to caller
    return { success: false, error: result.error };
  }

  return {
    success: true,
    data: { chainJson: JSON.stringify(result.chain) },
  };
}

// TLS handshakes can be flaky - allow more retries
fetchCertificateChainStep.maxRetries = 5;

/**
 * Step: Detect CA providers from issuer names and build response.
 *
 * @param chainJson - JSON-serialized certificate chain
 * @returns Processed certificates with provider IDs and expiry metadata
 */
export async function processChainStep(
  chainJson: string,
): Promise<CertificatesProcessedData> {
  "use step";

  // Dynamic imports to avoid top-level db/network dependencies
  const { getProviderCatalog } = await import("@/lib/edge-config");
  const { detectCertificateAuthority, getProvidersFromCatalog } = await import(
    "@domainstack/core/providers"
  );
  const { providersRepo } = await import("@/lib/db/repos");

  const chain = JSON.parse(chainJson) as RawCertificate[];
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
        const ref = await providersRepo.upsertCatalogProvider(catalogProvider);
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

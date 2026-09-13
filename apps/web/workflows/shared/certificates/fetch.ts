/**
 * Certificates fetch step.
 *
 * Fetches TLS certificate chain from a domain via TLS handshake.
 * Unreachable hosts and handshake failures are returned as typed results
 * so tracking workflows can continue without certificate data.
 */

import type { CertificatesProcessedData } from "@domainstack/server/services/certificates";
import type { TlsFetchResult, TlsFetchSuccess } from "@domainstack/server/tls";

/**
 * Step: Fetch certificate chain via TLS handshake.
 *
 * DNS, TLS, timeout, and unreachable-host errors are returned as typed
 * results so tracking workflows can continue without certificate data.
 *
 * @param domain - The domain to connect to
 * @returns The server TLS result with typed errors on failure
 */
export async function fetchCertificateChainStep(domain: string): Promise<TlsFetchResult> {
  "use step";

  // Dynamic import to keep step bundle small
  const { fetchCertificateChain } = await import("@domainstack/server/tls");

  return await fetchCertificateChain(domain);
}

/**
 * Step: Detect CA providers from issuer names and build response.
 *
 * @param fetchData - Certificate chain plus TLS observation
 * @returns Processed certificates with provider IDs and expiry metadata
 */
export async function processChainStep(
  fetchData: TlsFetchSuccess,
): Promise<CertificatesProcessedData> {
  "use step";

  const { processChain } = await import("@domainstack/server/services/certificates");
  return await processChain(fetchData);
}

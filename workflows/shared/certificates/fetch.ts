/**
 * Certificates fetch step.
 *
 * Fetches TLS certificate chain from a domain via TLS handshake.
 * This step is shared between the dedicated certificatesWorkflow and internal workflows.
 */

import { RetryableError } from "workflow";
import type { Certificate } from "@/lib/types/domain/certificates";
import type {
  CertificatesProcessedData,
  FetchCertificatesResult,
  RawCertificate,
} from "./types";

interface TlsFetchSuccess {
  success: true;
  chain: RawCertificate[];
}

interface TlsFetchFailure {
  success: false;
  error: "dns_error" | "tls_error" | "fetch_error";
}

type TlsFetchResult = TlsFetchSuccess | TlsFetchFailure;

/**
 * Step: Fetch certificate chain via TLS handshake.
 *
 * DNS and TLS errors are permanent failures.
 * fetch_error is thrown as RetryableError for automatic retry.
 *
 * @param domain - The domain to connect to
 * @returns FetchCertificatesResult with typed error on failure
 */
export async function fetchCertificateChainStep(
  domain: string,
): Promise<FetchCertificatesResult> {
  "use step";

  // Dynamic imports for Node.js modules that aren't available in workflow context
  const tls = await import("node:tls");
  const { createLogger } = await import("@/lib/logger/server");
  const { isExpectedDnsError } = await import("@/lib/dns-utils");
  const { isExpectedTlsError, parseAltNames, toName } = await import(
    "@/lib/tls-utils"
  );

  const logger = createLogger({ source: "certificates-fetch" });

  type DetailedPeerCertificate = import("node:tls").DetailedPeerCertificate;

  // Inline fetchCertificateChain logic with dynamic imports
  const fetchResult = await (async (): Promise<TlsFetchResult> => {
    try {
      const chain = await new Promise<RawCertificate[]>((resolve, reject) => {
        let isDestroyed = false;

        const socket = tls.connect(
          {
            host: domain,
            port: 443,
            servername: domain,
            rejectUnauthorized: false,
          },
          () => {
            socket.setTimeout(0);
            const peer = socket.getPeerCertificate(
              true,
            ) as DetailedPeerCertificate;

            const chain: RawCertificate[] = [];
            let current: DetailedPeerCertificate | null = peer;

            while (current) {
              chain.push({
                issuer: toName(current.issuer),
                subject: toName(current.subject),
                altNames: parseAltNames(
                  (current as Partial<{ subjectaltname: string }>)
                    .subjectaltname,
                ),
                validFrom: new Date(current.valid_from).toISOString(),
                validTo: new Date(current.valid_to).toISOString(),
              });

              const next = (
                current as unknown as { issuerCertificate?: unknown }
              ).issuerCertificate as DetailedPeerCertificate | undefined;
              current = next && next !== current ? next : null;
            }

            socket.end();
            resolve(chain);
          },
        );

        socket.setTimeout(6000, () => {
          if (!isDestroyed) {
            isDestroyed = true;
            socket.destroy(new Error("TLS timeout"));
          }
        });

        socket.on("error", (err) => {
          if (!isDestroyed) {
            isDestroyed = true;
            socket.destroy();
          }
          reject(err);
        });
      });

      return { success: true, chain };
    } catch (err) {
      if (isExpectedDnsError(err)) {
        logger.debug({ err, domain }, "DNS resolution failed");
        return { success: false, error: "dns_error" };
      }

      if (isExpectedTlsError(err)) {
        logger.debug({ err, domain }, "TLS handshake failed");
        return { success: false, error: "tls_error" };
      }

      logger.warn({ err, domain }, "certificate fetch failed");
      return { success: false, error: "fetch_error" };
    }
  })();

  if (!fetchResult.success) {
    if (fetchResult.error === "fetch_error") {
      throw new RetryableError("Certificate fetch failed", {
        retryAfter: "5s",
      });
    }

    const error =
      fetchResult.error === "dns_error"
        ? "dns_error"
        : fetchResult.error === "tls_error"
          ? "tls_error"
          : "connection_failed";

    return {
      success: false,
      error,
    };
  }

  return {
    success: true,
    data: { chainJson: JSON.stringify(fetchResult.chain) },
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
  const { getProviders } = await import("@/lib/providers/catalog");
  const { detectCertificateAuthority } = await import(
    "@/lib/providers/detection"
  );
  const { upsertCatalogProvider } = await import("@/lib/db/repos/providers");

  const chain = JSON.parse(chainJson) as RawCertificate[];
  const caProviders = await getProviders("ca");

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

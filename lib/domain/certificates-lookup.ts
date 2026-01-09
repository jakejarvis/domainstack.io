/**
 * Certificates lookup implementation - core logic for TLS certificate fetching.
 *
 * This module contains the business logic extracted from the certificates workflow.
 * It's used by both the standalone certificatesWorkflow and shared steps.
 */

import type { DetailedPeerCertificate } from "node:tls";
import * as tls from "node:tls";
import { isExpectedDnsError } from "@/lib/dns-utils";
import { createLogger } from "@/lib/logger/server";
import { isExpectedTlsError, parseAltNames, toName } from "@/lib/tls-utils";
import type { Certificate, CertificatesResponse } from "@/lib/types";

const logger = createLogger({ source: "certificates-lookup" });

// Serializable certificate data from TLS handshake
interface RawCertificate {
  issuer: string;
  subject: string;
  altNames: string[];
  validFrom: string;
  validTo: string;
}

export interface TlsFetchSuccess {
  success: true;
  chain: RawCertificate[];
}

export interface TlsFetchFailure {
  success: false;
  error: "dns_error" | "tls_error" | "fetch_error";
}

export type TlsFetchResult = TlsFetchSuccess | TlsFetchFailure;

/**
 * Fetch TLS certificate chain from a domain.
 *
 * Returns the certificate chain or an error.
 * "fetch_error" means the caller should retry.
 */
export async function fetchCertificateChain(
  domain: string,
): Promise<TlsFetchResult> {
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
                (current as Partial<{ subjectaltname: string }>).subjectaltname,
              ),
              validFrom: new Date(current.valid_from).toISOString(),
              validTo: new Date(current.valid_to).toISOString(),
            });

            const next = (current as unknown as { issuerCertificate?: unknown })
              .issuerCertificate as DetailedPeerCertificate | undefined;
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
}

/**
 * Detect CA providers from certificate chain and build response.
 *
 * Uses dynamic imports to avoid top-level db dependencies.
 */
export async function processCertificateChain(
  chain: RawCertificate[],
): Promise<{
  certificates: Certificate[];
  providerIds: (string | null)[];
  earliestValidTo: Date;
}> {
  // Dynamic imports to avoid top-level db/network dependencies
  const { getProviders } = await import("@/lib/providers/catalog");
  const { detectCertificateAuthority } = await import(
    "@/lib/providers/detection"
  );
  const { upsertCatalogProviderRef } = await import("@/lib/db/repos/providers");

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
        const ref = await upsertCatalogProviderRef(catalogProvider);
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
      : new Date(Date.now() + 3600_000);

  return { certificates, providerIds, earliestValidTo };
}

/**
 * Persist certificates to database.
 *
 * Uses dynamic imports to avoid top-level db dependencies.
 */
export async function persistCertificatesData(
  domain: string,
  result: {
    certificates: Certificate[];
    providerIds: (string | null)[];
    earliestValidTo: Date;
  },
): Promise<void> {
  // Dynamic imports to avoid top-level db dependencies
  const { ensureDomainRecord } = await import("@/lib/db/repos/domains");
  const { replaceCertificates } = await import("@/lib/db/repos/certificates");
  const { scheduleRevalidation } = await import("@/lib/schedule");
  const { ttlForCertificates } = await import("@/lib/ttl");

  const now = new Date();

  // Ensure domain record exists (creates if needed)
  const domainRecord = await ensureDomainRecord(domain);

  const chainWithIds = result.certificates.map((c, i) => ({
    issuer: c.issuer,
    subject: c.subject,
    altNames: c.altNames,
    validFrom: new Date(c.validFrom),
    validTo: new Date(c.validTo),
    caProviderId: result.providerIds[i],
  }));

  const expiresAt = ttlForCertificates(now, result.earliestValidTo);

  await replaceCertificates({
    domainId: domainRecord.id,
    chain: chainWithIds,
    fetchedAt: now,
    expiresAt,
  });

  // Schedule background revalidation
  await scheduleRevalidation(
    domain,
    "certificates",
    expiresAt.getTime(),
    domainRecord.lastAccessedAt ?? null,
  );

  logger.debug({ domain }, "certificates persisted");
}

/**
 * Full certificate lookup and persist in one operation.
 *
 * This is the main entry point for shared steps.
 */
export async function lookupAndPersistCertificates(
  domain: string,
): Promise<CertificatesResponse | null> {
  const tlsResult = await fetchCertificateChain(domain);

  if (!tlsResult.success) {
    if (tlsResult.error === "fetch_error") {
      return null; // Caller should retry
    }
    // Return error response for permanent failures
    return {
      certificates: [],
      ...(tlsResult.error === "tls_error" && {
        error: "Invalid SSL certificate",
      }),
    };
  }

  const processed = await processCertificateChain(tlsResult.chain);

  try {
    await persistCertificatesData(domain, processed);
  } catch (err) {
    logger.error({ err, domain }, "failed to persist certificates");
    // Still return the data even if persistence failed
  }

  return { certificates: processed.certificates };
}

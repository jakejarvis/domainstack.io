import type {
  DetailedPeerCertificate,
  Certificate as TlsCertificate,
} from "node:tls";
import { RetryableError } from "workflow";
import type { Provider } from "@/lib/providers/parser";
import type { Certificate, CertificatesResponse } from "@/lib/types";

export interface CertificatesWorkflowInput {
  domain: string;
}

export type CertificatesWorkflowResult =
  | {
      success: true;
      data: CertificatesResponse;
    }
  | {
      success: false;
      error: "dns_error" | "tls_error" | "timeout" | "connection_failed";
      data: CertificatesResponse;
    };

// Internal types for TLS result - serializable for step-to-step transfer
interface TlsFetchSuccess {
  success: true;
  // Certificate chain as JSON for serialization
  chainJson: string;
}

interface TlsFetchFailure {
  success: false;
  isDnsError: boolean;
  isTlsError: boolean;
}

type TlsFetchResult = TlsFetchSuccess | TlsFetchFailure;

// Serializable certificate data from TLS handshake
interface RawCertificate {
  issuer: string;
  subject: string;
  altNames: string[];
  validFrom: string;
  validTo: string;
}

/**
 * Durable certificates workflow that breaks down TLS certificate fetching into
 * independently retryable steps:
 * 1. Fetch certificate chain (TLS handshake - the slow operation)
 * 2. Detect CA providers
 * 3. Persist to database
 */
export async function certificatesWorkflow(
  input: CertificatesWorkflowInput,
): Promise<CertificatesWorkflowResult> {
  "use workflow";

  const { domain } = input;

  // Step 1: Fetch certificate chain via TLS handshake
  const tlsResult = await fetchCertificateChain(domain);

  if (!tlsResult.success) {
    const errorType = tlsResult.isDnsError
      ? "dns_error"
      : tlsResult.isTlsError
        ? "tls_error"
        : "connection_failed";

    return {
      success: false,
      error: errorType,
      data: {
        certificates: [],
        ...(tlsResult.isTlsError && { error: "Invalid SSL certificate" }),
      },
    };
  }

  // Step 2: Detect CA providers and build response
  const processedResult = await detectProvidersAndBuildResponse(
    tlsResult.chainJson,
  );

  // Step 3: Persist to database
  await persistCertificates(domain, processedResult);

  return {
    success: true,
    data: { certificates: processedResult.certificates },
  };
}

/**
 * Step: Fetch certificate chain via TLS handshake
 * This is the slow operation that benefits from workflow durability.
 */
async function fetchCertificateChain(domain: string): Promise<TlsFetchResult> {
  "use step";

  const tls = await import("node:tls");
  const { isExpectedDnsError } = await import("@/lib/dns-utils");
  const { isExpectedTlsError } = await import("@/lib/fetch");
  const { createLogger } = await import("@/lib/logger/server");

  const logger = createLogger({ source: "certificates-workflow" });

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

    return { success: true, chainJson: JSON.stringify(chain) };
  } catch (err) {
    if (isExpectedDnsError(err)) {
      // Permanent failure - domain doesn't resolve, return graceful result
      logger.debug({ err, domain }, "DNS resolution failed");
      return { success: false, isDnsError: true, isTlsError: false };
    }

    if (isExpectedTlsError(err)) {
      // Permanent failure - cert is invalid, return graceful result
      logger.debug({ err, domain }, "TLS handshake failed");
      return {
        success: false,
        isDnsError: false,
        isTlsError: true,
      };
    }

    // Unknown/transient error - throw to trigger retry
    logger.warn({ err, domain }, "certificate fetch failed, will retry");
    throw new RetryableError("Certificate fetch failed", { retryAfter: "5s" });
  }
}

/**
 * Step: Detect CA providers from issuer names and build response
 */
async function detectProvidersAndBuildResponse(chainJson: string): Promise<{
  certificates: Certificate[];
  providerIds: (string | null)[];
  earliestValidTo: Date;
}> {
  "use step";

  const { getProviders } = await import("@/lib/providers/catalog");
  const { detectCertificateAuthority } = await import(
    "@/lib/providers/detection"
  );
  const { upsertCatalogProviderRef } = await import("@/lib/db/repos/providers");

  const chain = JSON.parse(chainJson) as RawCertificate[];
  const caProviders = await getProviders("ca");

  // Detect providers and upsert to get IDs
  const certificatesWithMatches: Array<{
    cert: Certificate;
    catalogProvider: Provider | null;
  }> = chain.map((c) => {
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
 * Step: Persist certificates to database
 */
async function persistCertificates(
  domain: string,
  result: {
    certificates: Certificate[];
    providerIds: (string | null)[];
    earliestValidTo: Date;
  },
): Promise<void> {
  "use step";

  const { ensureDomainRecord } = await import("@/lib/db/repos/domains");
  const { replaceCertificates } = await import("@/lib/db/repos/certificates");
  const { scheduleRevalidation } = await import("@/lib/schedule");
  const { ttlForCertificates } = await import("@/lib/ttl");
  const { createLogger } = await import("@/lib/logger/server");

  const logger = createLogger({ source: "certificates-workflow" });
  const now = new Date();

  try {
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
  } catch (err) {
    logger.error({ err, domain }, "failed to persist certificates");
    // Don't throw - persistence failure shouldn't fail the workflow
  }
}

// Helper functions (exported for testing and reuse)

export function toName(subject: TlsCertificate | undefined): string {
  if (!subject) return "";
  const cn = typeof subject.CN === "string" ? subject.CN : undefined;
  const o = typeof subject.O === "string" ? subject.O : undefined;
  return cn ? cn : o ? o : JSON.stringify(subject);
}

export function parseAltNames(subjectAltName: string | undefined): string[] {
  if (typeof subjectAltName !== "string" || subjectAltName.length === 0) {
    return [];
  }
  return subjectAltName
    .split(",")
    .map((segment) => segment.trim())
    .map((segment) => {
      const idx = segment.indexOf(":");
      if (idx === -1) return ["", segment] as const;
      const kind = segment.slice(0, idx).trim().toUpperCase();
      const value = segment.slice(idx + 1).trim();
      return [kind, value] as const;
    })
    .filter(
      ([kind, value]) => !!value && (kind === "DNS" || kind === "IP ADDRESS"),
    )
    .map(([_, value]) => value);
}

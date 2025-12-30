import tls from "node:tls";
import { eq } from "drizzle-orm";
import { after } from "next/server";
import { db } from "@/lib/db/client";
import { replaceCertificates } from "@/lib/db/repos/certificates";
import { findDomainByName } from "@/lib/db/repos/domains";
import {
  batchResolveOrCreateProviderIds,
  makeProviderKey,
} from "@/lib/db/repos/providers";
import {
  certificates as certTable,
  providers as providersTable,
} from "@/lib/db/schema";
import { isExpectedDnsError } from "@/lib/dns-utils";
import { isExpectedTlsError } from "@/lib/fetch";
import { createLogger } from "@/lib/logger/server";
import { detectCertificateAuthority } from "@/lib/providers/detection";
import { scheduleRevalidation } from "@/lib/schedule";
import type { Certificate, CertificatesResponse } from "@/lib/schemas";
import { ttlForCertificates } from "@/lib/ttl";

const logger = createLogger({ source: "certificates" });

export type ServiceOptions = {
  skipScheduling?: boolean;
};

/**
 * Safely coerce altNames from DB to string array.
 * Guards against non-array values that could slip through serialization.
 */
function safeAltNamesArray(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.filter((item): item is string => typeof item === "string");
  }
  return [];
}

export async function getCertificates(
  domain: string,
  options: ServiceOptions = {},
): Promise<CertificatesResponse> {
  // Generate single timestamp for access tracking and scheduling
  const now = new Date();
  const nowMs = now.getTime();

  // Fast path: Check Postgres for cached certificate data (join with providers)
  const existingDomain = await findDomainByName(domain);
  const existing = existingDomain
    ? await db
        .select({
          issuer: certTable.issuer,
          subject: certTable.subject,
          altNames: certTable.altNames,
          validFrom: certTable.validFrom,
          validTo: certTable.validTo,
          caProviderId: providersTable.id,
          caProviderDomain: providersTable.domain,
          caProviderName: providersTable.name,
          expiresAt: certTable.expiresAt,
        })
        .from(certTable)
        .leftJoin(providersTable, eq(certTable.caProviderId, providersTable.id))
        .where(eq(certTable.domainId, existingDomain.id))
        // Order by validTo ASC: leaf certificates typically expire first (shorter validity period)
        // This preserves the chain order: leaf -> intermediate -> root
        .orderBy(certTable.validTo)
    : ([] as Array<{
        issuer: string;
        subject: string;
        altNames: unknown;
        validFrom: Date;
        validTo: Date;
        caProviderId: string | null;
        caProviderDomain: string | null;
        caProviderName: string | null;
        expiresAt: Date | null;
      }>);
  if (existing.length > 0) {
    const fresh = existing.every(
      (c) => (c.expiresAt?.getTime?.() ?? 0) > nowMs,
    );
    if (fresh) {
      const out: Certificate[] = existing.map((c) => ({
        issuer: c.issuer,
        subject: c.subject,
        altNames: safeAltNamesArray(c.altNames),
        validFrom: new Date(c.validFrom).toISOString(),
        validTo: new Date(c.validTo).toISOString(),
        // Use cached provider data if available, otherwise detect
        caProvider:
          c.caProviderDomain && c.caProviderName
            ? {
                id: c.caProviderId ?? null,
                domain: c.caProviderDomain,
                name: c.caProviderName,
              }
            : { id: null, ...detectCertificateAuthority(c.issuer) },
      }));

      return { certificates: out };
    }
  }

  // Client gating avoids calling this without A/AAAA; server does not pre-check DNS here.
  // Probe TLS connection to get certificate chain
  // Note: Certificates are returned in chain order (leaf -> intermediate -> root)
  // because leaf certificates expire first (shorter validity period)
  try {
    const chain = await new Promise<tls.DetailedPeerCertificate[]>(
      (resolve, reject) => {
        let isDestroyed = false;
        const socket = tls.connect(
          {
            host: domain,
            port: 443,
            servername: domain,
            rejectUnauthorized: false,
          },
          () => {
            // Clear timeout on successful connection
            socket.setTimeout(0);
            const peer = socket.getPeerCertificate(
              true,
            ) as tls.DetailedPeerCertificate;
            const chain: tls.DetailedPeerCertificate[] = [];
            let current: tls.DetailedPeerCertificate | null = peer;
            while (current) {
              chain.push(current);
              const next = (
                current as unknown as { issuerCertificate?: unknown }
              ).issuerCertificate as tls.DetailedPeerCertificate | undefined;
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
          // Destroy socket before rejecting to ensure cleanup
          // Guard against double-destroy (socket.destroy can trigger error event)
          if (!isDestroyed) {
            isDestroyed = true;
            socket.destroy();
          }
          reject(err);
        });
      },
    );

    const out: Certificate[] = chain.map((c) => {
      const issuerName = toName(c.issuer);
      return {
        issuer: issuerName,
        subject: toName(c.subject),
        altNames: parseAltNames(
          (c as Partial<{ subjectaltname: string }>).subjectaltname,
        ),
        validFrom: new Date(c.valid_from).toISOString(),
        validTo: new Date(c.valid_to).toISOString(),
        caProvider: {
          id: null,
          ...detectCertificateAuthority(issuerName),
        },
      };
    });

    const earliestValidTo =
      out.length > 0
        ? new Date(Math.min(...out.map((c) => new Date(c.validTo).getTime())))
        : new Date(Date.now() + 3600_000);

    // Persist to Postgres only if domain exists (i.e., is registered)
    if (existingDomain) {
      // Batch resolve all CA providers in one query
      // Filter out entries with null/empty domain or name to avoid creating bogus providers
      const caProviderInputs = out
        .filter(
          (c) =>
            c.caProvider.domain &&
            c.caProvider.name &&
            c.caProvider.domain.trim() !== "" &&
            c.caProvider.name.trim() !== "",
        )
        .map((c) => ({
          category: "ca" as const,
          domain: c.caProvider.domain,
          name: c.caProvider.name,
        }));

      const caProviderMap =
        await batchResolveOrCreateProviderIds(caProviderInputs);

      // Helper to resolve provider ID for a certificate
      const resolveProviderId = (cert: (typeof out)[number]): string | null => {
        const hasValidProvider =
          cert.caProvider.domain &&
          cert.caProvider.name &&
          cert.caProvider.domain.trim() !== "" &&
          cert.caProvider.name.trim() !== "";

        if (!hasValidProvider) {
          return null;
        }

        return (
          caProviderMap.get(
            makeProviderKey("ca", cert.caProvider.domain, cert.caProvider.name),
          ) ?? null
        );
      };

      // Resolve provider IDs once and store them
      const providerIds = out.map((cert) => resolveProviderId(cert));

      // Update out array with resolved provider IDs
      for (let i = 0; i < out.length; i++) {
        if (providerIds[i]) {
          out[i].caProvider.id = providerIds[i];
        }
      }

      // Build chain with provider IDs for database persistence
      const chainWithIds = out.map((c, i) => ({
        issuer: c.issuer,
        subject: c.subject,
        altNames: c.altNames,
        validFrom: new Date(c.validFrom),
        validTo: new Date(c.validTo),
        caProviderId: providerIds[i],
      }));

      const nextDue = ttlForCertificates(now, earliestValidTo);
      await replaceCertificates({
        domainId: existingDomain.id,
        chain: chainWithIds,
        fetchedAt: now,
        expiresAt: nextDue,
      });

      if (!options.skipScheduling) {
        after(() =>
          scheduleRevalidation(
            domain,
            "certificates",
            nextDue.getTime(),
            existingDomain.lastAccessedAt ?? null,
          ),
        );
      }
    }

    return { certificates: out };
  } catch (err) {
    if (isExpectedDnsError(err)) {
      logger.debug("no certificates found (DNS lookup failed)", {
        domain,
        error: err instanceof Error ? err.message : String(err),
      });
      return { certificates: [] };
    }

    if (isExpectedTlsError(err)) {
      logger.debug("probe failed (TLS error)", {
        domain,
        error: err instanceof Error ? err.message : String(err),
      });
      return {
        certificates: [],
        error: "Invalid SSL certificate",
      };
    }

    logger.error("probe failed (unexpected error)", err, { domain });

    // Rethrow to let callers distinguish between:
    // - Empty array: domain has no certificates (legitimately empty)
    // - Error thrown: TLS probe failed (network, timeout, invalid cert, etc.)
    // Callers should handle this appropriately (e.g., retry, show error state)
    throw err;
  }
}

export function toName(subject: tls.PeerCertificate["subject"] | undefined) {
  if (!subject) return "";
  const maybeRecord = subject as unknown as Record<string, unknown>;
  const cn =
    typeof maybeRecord?.CN === "string"
      ? (maybeRecord.CN as string)
      : undefined;
  const o =
    typeof maybeRecord?.O === "string" ? (maybeRecord.O as string) : undefined;
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

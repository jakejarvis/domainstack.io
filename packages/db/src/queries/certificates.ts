import type { InferInsertModel } from "drizzle-orm";
import { and, asc, eq, isNull, or } from "drizzle-orm";

import type { Certificate, CertificatesResponse } from "@domainstack/types";

import { db } from "../client";
import {
  certificateChecks,
  certificates,
  domains,
  providers,
  users,
  userTrackedDomains,
} from "../schema";
import type { CacheResult } from "../types";

type CertificateInsert = InferInsertModel<typeof certificates>;

/** Leaf when known; NULL `chain_position` is pre-migration data treated as the site cert. */
const leafOrLegacyCertificate = or(
  eq(certificates.chainPosition, 0),
  isNull(certificates.chainPosition),
);

export interface CertificateCheckValues {
  valid: boolean;
  validationError: string | null;
  protocol: string | null;
  cipher: string | null;
  publicKeyBits: number | null;
  chainComplete: boolean;
}

export interface UpsertCertificatesParams {
  domainId: string;
  chain: Array<Omit<CertificateInsert, "id" | "domainId" | "fetchedAt" | "expiresAt">>;
  check: CertificateCheckValues;
  fetchedAt: Date;
  expiresAt: Date; // policy window for revalidation (not cert validity)
}

export interface TrackedDomainCertificate {
  trackedDomainId: string;
  userId: string;
  domainId: string;
  domainName: string;
  muted: boolean;
  validTo: Date;
  issuer: string;
  userEmail: string;
  userName: string;
}

export async function replaceCertificates(params: UpsertCertificatesParams) {
  const { domainId, check } = params;
  // Atomic check upsert and chain replace in a single transaction
  await db.transaction(async (tx) => {
    await tx
      .insert(certificateChecks)
      .values({
        domainId,
        valid: check.valid,
        validationError: check.validationError,
        protocol: check.protocol,
        cipher: check.cipher,
        publicKeyBits: check.publicKeyBits,
        chainComplete: check.chainComplete,
        fetchedAt: params.fetchedAt,
        expiresAt: params.expiresAt,
      })
      .onConflictDoUpdate({
        target: certificateChecks.domainId,
        set: {
          valid: check.valid,
          validationError: check.validationError,
          protocol: check.protocol,
          cipher: check.cipher,
          publicKeyBits: check.publicKeyBits,
          chainComplete: check.chainComplete,
          fetchedAt: params.fetchedAt,
          expiresAt: params.expiresAt,
        },
      });

    await tx.delete(certificates).where(eq(certificates.domainId, domainId));
    if (params.chain.length > 0) {
      await tx.insert(certificates).values(
        params.chain.map((c) => ({
          domainId,
          issuer: c.issuer,
          subject: c.subject,
          altNames: c.altNames,
          validFrom: c.validFrom,
          validTo: c.validTo,
          fingerprint256: c.fingerprint256 ?? null,
          serialNumber: c.serialNumber ?? null,
          caProviderId: c.caProviderId ?? null,
          chainPosition: c.chainPosition ?? null,
          fetchedAt: params.fetchedAt,
          expiresAt: params.expiresAt,
        })),
      );
    }
  });
}

/**
 * Get cached certificates for a domain with staleness metadata.
 * Returns data even if expired, with `stale: true` flag.
 *
 * Legacy certificate rows without a `certificate_checks` row are a cache miss
 * so they refresh normally rather than requiring a destructive backfill.
 *
 * Note: This queries the database cache. For fetching fresh data,
 * use `fetchCertificateChainStep` from workflows/shared/certificates.
 */
export async function getCachedCertificates(
  domain: string,
): Promise<CacheResult<CertificatesResponse>> {
  const nowMs = Date.now();

  const existing = await db
    .select({
      issuer: certificates.issuer,
      subject: certificates.subject,
      altNames: certificates.altNames,
      validFrom: certificates.validFrom,
      validTo: certificates.validTo,
      fingerprint256: certificates.fingerprint256,
      serialNumber: certificates.serialNumber,
      chainPosition: certificates.chainPosition,
      caProviderId: providers.id,
      caProviderDomain: providers.domain,
      caProviderName: providers.name,
      valid: certificateChecks.valid,
      validationError: certificateChecks.validationError,
      protocol: certificateChecks.protocol,
      cipher: certificateChecks.cipher,
      publicKeyBits: certificateChecks.publicKeyBits,
      chainComplete: certificateChecks.chainComplete,
      fetchedAt: certificateChecks.fetchedAt,
      expiresAt: certificateChecks.expiresAt,
    })
    .from(domains)
    .innerJoin(certificateChecks, eq(certificateChecks.domainId, domains.id))
    .innerJoin(certificates, eq(certificates.domainId, domains.id))
    .leftJoin(providers, eq(certificates.caProviderId, providers.id))
    .where(eq(domains.name, domain))
    .orderBy(asc(certificates.chainPosition));

  if (existing.length === 0) {
    return { data: null, stale: false, fetchedAt: null, expiresAt: null };
  }

  const check = existing[0];
  const fetchedAt = check.fetchedAt;
  const expiresAt = check.expiresAt;
  const stale = (expiresAt?.getTime?.() ?? 0) <= nowMs;

  const chained: Certificate[] = existing.map((c) => ({
    issuer: c.issuer,
    subject: c.subject,
    altNames: safeAltNamesArray(c.altNames),
    validFrom: new Date(c.validFrom).toISOString(),
    validTo: new Date(c.validTo).toISOString(),
    fingerprint256: c.fingerprint256 ?? null,
    serialNumber: c.serialNumber ?? null,
    chainPosition: c.chainPosition ?? 0,
    caProvider: {
      id: c.caProviderId ?? null,
      domain: c.caProviderDomain ?? null,
      name: c.caProviderName ?? null,
    },
  }));

  return {
    data: {
      certificates: chained,
      valid: check.valid,
      validationError: check.validationError,
      protocol: check.protocol,
      cipher: check.cipher,
      publicKeyBits: check.publicKeyBits,
      chainComplete: check.chainComplete,
    },
    stale,
    fetchedAt,
    expiresAt,
  };
}

/**
 * Get tracked domain IDs that have a current certificate check.
 * Used by the certificate expiry scheduler.
 */
export async function getVerifiedTrackedDomainIdsWithCertificates(): Promise<string[]> {
  const rows = await db
    .selectDistinct({
      trackedDomainId: userTrackedDomains.id,
    })
    .from(userTrackedDomains)
    .innerJoin(domains, eq(userTrackedDomains.domainId, domains.id))
    .innerJoin(certificateChecks, eq(domains.id, certificateChecks.domainId))
    .innerJoin(certificates, eq(domains.id, certificates.domainId))
    .where(
      and(
        eq(userTrackedDomains.verified, true),
        isNull(userTrackedDomains.archivedAt),
        leafOrLegacyCertificate,
      ),
    );

  return rows.map((r) => r.trackedDomainId);
}

/**
 * Get the leaf certificate for a tracked domain.
 * Used by the certificate expiry worker — alerts describe the site certificate.
 */
export async function getEarliestCertificate(
  trackedDomainId: string,
): Promise<TrackedDomainCertificate | null> {
  const rows = await db
    .select({
      trackedDomainId: userTrackedDomains.id,
      userId: userTrackedDomains.userId,
      domainId: userTrackedDomains.domainId,
      domainName: domains.name,
      muted: userTrackedDomains.muted,
      validTo: certificates.validTo,
      issuer: certificates.issuer,
      userEmail: users.email,
      userName: users.name,
    })
    .from(userTrackedDomains)
    .innerJoin(domains, eq(userTrackedDomains.domainId, domains.id))
    .innerJoin(certificates, eq(domains.id, certificates.domainId))
    .innerJoin(users, eq(userTrackedDomains.userId, users.id))
    .where(and(eq(userTrackedDomains.id, trackedDomainId), leafOrLegacyCertificate))
    .orderBy(asc(certificates.chainPosition), asc(certificates.validTo))
    .limit(1);

  return rows[0] ?? null;
}

function safeAltNamesArray(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.filter((item): item is string => typeof item === "string");
  }
  return [];
}

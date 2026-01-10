import "server-only";

import type { InferInsertModel } from "drizzle-orm";
import { and, asc, eq, isNull } from "drizzle-orm";
import { db } from "@/lib/db/client";
import {
  certificates,
  domains,
  providers,
  users,
  userTrackedDomains,
} from "@/lib/db/schema";
import type {
  Certificate,
  CertificatesResponse,
} from "@/lib/types/domain/certificates";
import type { NotificationOverrides } from "@/lib/types/notifications";
import { findDomainByName } from "./domains";

type CertificateInsert = InferInsertModel<typeof certificates>;

export interface UpsertCertificatesParams {
  domainId: string;
  chain: Array<
    Omit<CertificateInsert, "id" | "domainId" | "fetchedAt" | "expiresAt">
  >;
  fetchedAt: Date;
  expiresAt: Date; // policy window for revalidation (not cert validity)
}

export async function replaceCertificates(params: UpsertCertificatesParams) {
  const { domainId } = params;
  // Atomic delete and bulk insert in a single transaction
  await db.transaction(async (tx) => {
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
          caProviderId: c.caProviderId ?? null,
          fetchedAt: params.fetchedAt,
          expiresAt: params.expiresAt,
        })),
      );
    }
  });
}

/**
 * Get cached certificates for a domain if fresh.
 * Returns null if cache miss or stale.
 */
export async function getCertificatesCached(
  domain: string,
): Promise<CertificatesResponse | null> {
  const now = new Date();
  const nowMs = now.getTime();

  try {
    const existingDomain = await findDomainByName(domain);
    if (!existingDomain) {
      return null;
    }

    const existing = await db
      .select({
        issuer: certificates.issuer,
        subject: certificates.subject,
        altNames: certificates.altNames,
        validFrom: certificates.validFrom,
        validTo: certificates.validTo,
        caProviderId: providers.id,
        caProviderDomain: providers.domain,
        caProviderName: providers.name,
        expiresAt: certificates.expiresAt,
      })
      .from(certificates)
      .leftJoin(providers, eq(certificates.caProviderId, providers.id))
      .where(eq(certificates.domainId, existingDomain.id))
      .orderBy(certificates.validTo);

    if (existing.length === 0) {
      return null;
    }

    const fresh = existing.every(
      (c) => (c.expiresAt?.getTime?.() ?? 0) > nowMs,
    );

    if (!fresh) {
      return null;
    }

    const certs: Certificate[] = existing.map((c) => ({
      issuer: c.issuer,
      subject: c.subject,
      altNames: safeAltNamesArray(c.altNames),
      validFrom: new Date(c.validFrom).toISOString(),
      validTo: new Date(c.validTo).toISOString(),
      caProvider: {
        id: c.caProviderId ?? null,
        domain: c.caProviderDomain ?? null,
        name: c.caProviderName ?? null,
      },
    }));

    return { certificates: certs };
  } catch {
    return null;
  }
}

function safeAltNamesArray(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.filter((item): item is string => typeof item === "string");
  }
  return [];
}

export interface TrackedDomainCertificate {
  trackedDomainId: string;
  userId: string;
  domainId: string;
  domainName: string;
  notificationOverrides: NotificationOverrides;
  validTo: Date;
  issuer: string;
  userEmail: string;
  userName: string;
}

/**
 * Get tracked domain IDs that have certificates.
 * Used by the certificate expiry scheduler.
 */
export async function getVerifiedTrackedDomainIdsWithCertificates(): Promise<
  string[]
> {
  const rows = await db
    .selectDistinct({
      trackedDomainId: userTrackedDomains.id,
    })
    .from(userTrackedDomains)
    .innerJoin(domains, eq(userTrackedDomains.domainId, domains.id))
    .innerJoin(certificates, eq(domains.id, certificates.domainId))
    .where(
      and(
        eq(userTrackedDomains.verified, true),
        isNull(userTrackedDomains.archivedAt),
      ),
    );

  return rows.map((r) => r.trackedDomainId);
}

/**
 * Get the earliest expiring certificate for a tracked domain.
 * Used by the certificate expiry worker.
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
      notificationOverrides: userTrackedDomains.notificationOverrides,
      validTo: certificates.validTo,
      issuer: certificates.issuer,
      userEmail: users.email,
      userName: users.name,
    })
    .from(userTrackedDomains)
    .innerJoin(domains, eq(userTrackedDomains.domainId, domains.id))
    .innerJoin(certificates, eq(domains.id, certificates.domainId))
    .innerJoin(users, eq(userTrackedDomains.userId, users.id))
    .where(eq(userTrackedDomains.id, trackedDomainId))
    .orderBy(asc(certificates.validTo))
    .limit(1);

  return rows[0] ?? null;
}

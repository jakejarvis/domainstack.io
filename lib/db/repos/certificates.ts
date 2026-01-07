import "server-only";

import type { InferInsertModel } from "drizzle-orm";
import { and, asc, eq, isNull } from "drizzle-orm";
import { db } from "@/lib/db/client";
import {
  certificates,
  domains,
  users,
  userTrackedDomains,
} from "@/lib/db/schema";
import type { NotificationOverrides } from "@/lib/types";

type CertificateInsert = InferInsertModel<typeof certificates>;

export type UpsertCertificatesParams = {
  domainId: string;
  chain: Array<
    Omit<CertificateInsert, "id" | "domainId" | "fetchedAt" | "expiresAt">
  >;
  fetchedAt: Date;
  expiresAt: Date; // policy window for revalidation (not cert validity)
};

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

export type TrackedDomainCertificate = {
  trackedDomainId: string;
  userId: string;
  domainId: string;
  domainName: string;
  notificationOverrides: NotificationOverrides;
  validTo: Date;
  issuer: string;
  userEmail: string;
  userName: string;
};

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

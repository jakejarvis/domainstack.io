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
import { CertificateInsert as CertificateInsertSchema } from "@/lib/db/zod";
import type { NotificationOverrides } from "@/lib/schemas";

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
        params.chain.map((c) =>
          CertificateInsertSchema.parse({
            domainId,
            issuer: c.issuer,
            subject: c.subject,
            altNames: c.altNames,
            validFrom: c.validFrom as Date | string,
            validTo: c.validTo as Date | string,
            caProviderId: c.caProviderId ?? null,
            fetchedAt: params.fetchedAt as Date | string,
            expiresAt: params.expiresAt as Date | string,
          }),
        ),
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
 * Get all certificates for verified, non-archived tracked domains.
 * Archived domains are excluded since archiving pauses monitoring.
 * Returns the earliest expiring certificate for each tracked domain.
 *
 * Uses PostgreSQL DISTINCT ON to efficiently get one certificate per tracked domain,
 * ordered by validTo ASC (earliest expiring first), avoiding in-memory grouping.
 */
export async function getVerifiedTrackedDomainsCertificates(): Promise<
  TrackedDomainCertificate[]
> {
  // Use DISTINCT ON to get the earliest expiring certificate per tracked domain
  // This is more efficient than fetching all certificates and grouping in JS
  const rows = await db
    .selectDistinctOn([userTrackedDomains.id], {
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
    .where(
      and(
        eq(userTrackedDomains.verified, true),
        isNull(userTrackedDomains.archivedAt),
      ),
    )
    // For DISTINCT ON, the first ORDER BY column(s) must match the DISTINCT ON columns
    // Then order by validTo ASC to get the earliest expiring certificate
    .orderBy(userTrackedDomains.id, asc(certificates.validTo));

  return rows;
}

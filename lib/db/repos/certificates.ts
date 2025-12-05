import "server-only";

import type { InferInsertModel } from "drizzle-orm";
import { eq } from "drizzle-orm";
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
 * Get all certificates for verified tracked domains.
 * Returns the leaf certificate (first in chain) for each domain.
 */
export async function getVerifiedTrackedDomainsCertificates(): Promise<
  TrackedDomainCertificate[]
> {
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
    .where(eq(userTrackedDomains.verified, true));

  // Group by tracked domain and take the earliest expiring certificate
  const byTrackedDomain = new Map<string, TrackedDomainCertificate>();

  for (const row of rows) {
    const existing = byTrackedDomain.get(row.trackedDomainId);
    if (!existing || row.validTo < existing.validTo) {
      byTrackedDomain.set(row.trackedDomainId, row);
    }
  }

  return Array.from(byTrackedDomain.values());
}

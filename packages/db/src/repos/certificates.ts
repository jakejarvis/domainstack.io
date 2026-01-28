import type { Certificate, CertificatesResponse } from "@domainstack/types";
import type { InferInsertModel } from "drizzle-orm";
import { and, asc, eq, isNull } from "drizzle-orm";
import {
  certificates,
  domains,
  providers,
  users,
  userTrackedDomains,
} from "../schema";
import type { CacheResult, DbClient } from "../types";

type CertificateInsert = InferInsertModel<typeof certificates>;

export interface UpsertCertificatesParams {
  domainId: string;
  chain: Array<
    Omit<CertificateInsert, "id" | "domainId" | "fetchedAt" | "expiresAt">
  >;
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

export function createCertificatesRepo(db: DbClient) {
  return {
    async replaceCertificates(params: UpsertCertificatesParams) {
      const { domainId } = params;
      // Atomic delete and bulk insert in a single transaction
      await db.transaction(async (tx) => {
        await tx
          .delete(certificates)
          .where(eq(certificates.domainId, domainId));
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
    },

    /**
     * Get cached certificates for a domain with staleness metadata.
     * Returns data even if expired, with `stale: true` flag.
     *
     * Note: This queries the database cache. For fetching fresh data,
     * use `fetchCertificateChainStep` from workflows/shared/certificates.
     *
     * Optimized: Uses a single query with JOINs to fetch domain and certificates,
     * reducing from 2 round trips to 1.
     */
    async getCachedCertificates(
      domain: string,
    ): Promise<CacheResult<CertificatesResponse>> {
      const nowMs = Date.now();

      // Single query: JOIN domains -> certificates with provider lookup
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
          fetchedAt: certificates.fetchedAt,
          expiresAt: certificates.expiresAt,
        })
        .from(domains)
        .innerJoin(certificates, eq(certificates.domainId, domains.id))
        .leftJoin(providers, eq(certificates.caProviderId, providers.id))
        .where(eq(domains.name, domain))
        .orderBy(certificates.validTo);

      if (existing.length === 0) {
        return { data: null, stale: false, fetchedAt: null, expiresAt: null };
      }

      // Find the earliest fetchedAt (oldest data) across all certificates
      const earliestFetchedAt = existing.reduce<Date | null>((earliest, c) => {
        if (!c.fetchedAt) return earliest;
        if (!earliest) return c.fetchedAt;
        return c.fetchedAt < earliest ? c.fetchedAt : earliest;
      }, null);

      // Find the earliest expiration across all certificates
      const earliestExpiresAt = existing.reduce<Date | null>((earliest, c) => {
        if (!c.expiresAt) return earliest;
        if (!earliest) return c.expiresAt;
        return c.expiresAt < earliest ? c.expiresAt : earliest;
      }, null);

      // Check if ANY certificate is stale
      const stale = existing.some(
        (c) => (c.expiresAt?.getTime?.() ?? 0) <= nowMs,
      );

      const chained: Certificate[] = existing.map((c) => ({
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

      return {
        data: { certificates: chained },
        stale,
        fetchedAt: earliestFetchedAt,
        expiresAt: earliestExpiresAt,
      };
    },

    /**
     * Get tracked domain IDs that have certificates.
     * Used by the certificate expiry scheduler.
     */
    async getVerifiedTrackedDomainIdsWithCertificates(): Promise<string[]> {
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
    },

    /**
     * Get the earliest expiring certificate for a tracked domain.
     * Used by the certificate expiry worker.
     */
    async getEarliestCertificate(
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
        .where(eq(userTrackedDomains.id, trackedDomainId))
        .orderBy(asc(certificates.validTo))
        .limit(1);

      return rows[0] ?? null;
    },
  };
}

function safeAltNamesArray(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.filter((item): item is string => typeof item === "string");
  }
  return [];
}

export type CertificatesRepo = ReturnType<typeof createCertificatesRepo>;

import "server-only";

import type { SQL } from "drizzle-orm";
import { and, asc, count, eq, inArray, isNotNull, isNull } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { db } from "@/lib/db/client";
import {
  domains,
  hosting,
  providers,
  registrations,
  users,
  userTrackedDomains,
  type verificationMethod,
  type verificationStatus,
} from "@/lib/db/schema";
import { createLogger } from "@/lib/logger/server";
import type { NotificationOverrides } from "@/lib/schemas";

const logger = createLogger({ source: "tracked-domains" });

export type VerificationMethod = (typeof verificationMethod.enumValues)[number];
export type VerificationStatusType =
  (typeof verificationStatus.enumValues)[number];

export type CreateTrackedDomainParams = {
  userId: string;
  domainId: string;
  verificationToken: string;
  verificationMethod?: VerificationMethod;
};

export type ProviderInfo = {
  name: string | null;
  domain: string | null;
};

export type TrackedDomainWithDetails = {
  id: string;
  userId: string;
  domainId: string;
  domainName: string;
  verified: boolean;
  verificationMethod: VerificationMethod | null;
  verificationToken: string;
  verificationStatus: VerificationStatusType;
  verificationFailedAt: Date | null;
  lastVerifiedAt: Date | null;
  notificationOverrides: NotificationOverrides;
  createdAt: Date;
  verifiedAt: Date | null;
  archivedAt: Date | null;
  expirationDate: Date | null;
  registrar: ProviderInfo;
  dns: ProviderInfo;
  hosting: ProviderInfo;
  email: ProviderInfo;
};

/**
 * Create a new tracked domain record.
 * Returns null if a record already exists (handles concurrent insert races).
 */
export async function createTrackedDomain(params: CreateTrackedDomainParams) {
  const { userId, domainId, verificationToken, verificationMethod } = params;

  const inserted = await db
    .insert(userTrackedDomains)
    .values({
      userId,
      domainId,
      verificationToken,
      verificationMethod,
    })
    .onConflictDoNothing()
    .returning();

  if (inserted.length === 0) {
    logger.debug("tracked domain already exists, skipping insert", {
      userId,
      domainId,
    });
    return null;
  }

  return inserted[0];
}

/**
 * Find a tracked domain by user and domain ID.
 */
export async function findTrackedDomain(userId: string, domainId: string) {
  const rows = await db
    .select()
    .from(userTrackedDomains)
    .where(
      and(
        eq(userTrackedDomains.userId, userId),
        eq(userTrackedDomains.domainId, domainId),
      ),
    )
    .limit(1);

  return rows[0] ?? null;
}

/**
 * Find a tracked domain by ID.
 */
export async function findTrackedDomainById(id: string) {
  const rows = await db
    .select()
    .from(userTrackedDomains)
    .where(eq(userTrackedDomains.id, id))
    .limit(1);

  return rows[0] ?? null;
}

export type TrackedDomainWithDomainName = {
  id: string;
  userId: string;
  domainName: string;
  verificationToken: string;
  verificationMethod: VerificationMethod | null;
  verified: boolean;
  verificationStatus: VerificationStatusType;
};

/**
 * Find a tracked domain by ID with its domain name (single targeted query).
 * Useful when you need the domain name without fetching all tracked domains.
 */
export async function findTrackedDomainWithDomainName(
  id: string,
): Promise<TrackedDomainWithDomainName | null> {
  const rows = await db
    .select({
      id: userTrackedDomains.id,
      userId: userTrackedDomains.userId,
      domainName: domains.name,
      verificationToken: userTrackedDomains.verificationToken,
      verificationMethod: userTrackedDomains.verificationMethod,
      verified: userTrackedDomains.verified,
      verificationStatus: userTrackedDomains.verificationStatus,
    })
    .from(userTrackedDomains)
    .innerJoin(domains, eq(userTrackedDomains.domainId, domains.id))
    .where(eq(userTrackedDomains.id, id))
    .limit(1);

  return rows[0] ?? null;
}

// Shared row type for the complex tracked domains query
type TrackedDomainRow = {
  id: string;
  userId: string;
  domainId: string;
  domainName: string;
  verified: boolean;
  verificationMethod: VerificationMethod | null;
  verificationToken: string;
  verificationStatus: VerificationStatusType;
  verificationFailedAt: Date | null;
  lastVerifiedAt: Date | null;
  notificationOverrides: NotificationOverrides;
  createdAt: Date;
  verifiedAt: Date | null;
  archivedAt: Date | null;
  expirationDate: Date | null;
  registrarName: string | null;
  registrarDomain: string | null;
  dnsName: string | null;
  dnsDomain: string | null;
  hostingName: string | null;
  hostingDomain: string | null;
  emailName: string | null;
  emailDomain: string | null;
};

/**
 * Transform flat query rows into nested TrackedDomainWithDetails structure.
 */
function transformToTrackedDomainWithDetails(
  row: TrackedDomainRow,
): TrackedDomainWithDetails {
  return {
    id: row.id,
    userId: row.userId,
    domainId: row.domainId,
    domainName: row.domainName,
    verified: row.verified,
    verificationMethod: row.verificationMethod,
    verificationToken: row.verificationToken,
    verificationStatus: row.verificationStatus,
    verificationFailedAt: row.verificationFailedAt,
    lastVerifiedAt: row.lastVerifiedAt,
    notificationOverrides: row.notificationOverrides,
    createdAt: row.createdAt,
    verifiedAt: row.verifiedAt,
    archivedAt: row.archivedAt,
    expirationDate: row.expirationDate,
    registrar: { name: row.registrarName, domain: row.registrarDomain },
    dns: { name: row.dnsName, domain: row.dnsDomain },
    hosting: { name: row.hostingName, domain: row.hostingDomain },
    email: { name: row.emailName, domain: row.emailDomain },
  };
}

/**
 * Internal helper to query tracked domains with full details.
 * Centralizes the complex select/join logic used by multiple public functions.
 */
async function queryTrackedDomainsWithDetails(
  whereCondition: SQL,
  orderByColumn:
    | typeof userTrackedDomains.createdAt
    | typeof userTrackedDomains.archivedAt,
): Promise<TrackedDomainWithDetails[]> {
  // Create aliases for the providers table (joined multiple times)
  const registrarProvider = alias(providers, "registrar_provider");
  const dnsProvider = alias(providers, "dns_provider");
  const hostingProvider = alias(providers, "hosting_provider");
  const emailProvider = alias(providers, "email_provider");

  const rows = await db
    .select({
      id: userTrackedDomains.id,
      userId: userTrackedDomains.userId,
      domainId: userTrackedDomains.domainId,
      domainName: domains.name,
      verified: userTrackedDomains.verified,
      verificationMethod: userTrackedDomains.verificationMethod,
      verificationToken: userTrackedDomains.verificationToken,
      verificationStatus: userTrackedDomains.verificationStatus,
      verificationFailedAt: userTrackedDomains.verificationFailedAt,
      lastVerifiedAt: userTrackedDomains.lastVerifiedAt,
      notificationOverrides: userTrackedDomains.notificationOverrides,
      createdAt: userTrackedDomains.createdAt,
      verifiedAt: userTrackedDomains.verifiedAt,
      archivedAt: userTrackedDomains.archivedAt,
      expirationDate: registrations.expirationDate,
      registrarName: registrarProvider.name,
      registrarDomain: registrarProvider.domain,
      dnsName: dnsProvider.name,
      dnsDomain: dnsProvider.domain,
      hostingName: hostingProvider.name,
      hostingDomain: hostingProvider.domain,
      emailName: emailProvider.name,
      emailDomain: emailProvider.domain,
    })
    .from(userTrackedDomains)
    .innerJoin(domains, eq(userTrackedDomains.domainId, domains.id))
    .leftJoin(registrations, eq(domains.id, registrations.domainId))
    .leftJoin(
      registrarProvider,
      eq(registrations.registrarProviderId, registrarProvider.id),
    )
    .leftJoin(hosting, eq(domains.id, hosting.domainId))
    .leftJoin(dnsProvider, eq(hosting.dnsProviderId, dnsProvider.id))
    .leftJoin(
      hostingProvider,
      eq(hosting.hostingProviderId, hostingProvider.id),
    )
    .leftJoin(emailProvider, eq(hosting.emailProviderId, emailProvider.id))
    .where(whereCondition)
    .orderBy(orderByColumn);

  return rows.map(transformToTrackedDomainWithDetails);
}

/**
 * Get all tracked domains for a user with domain details.
 * @param includeArchived - If true, returns all domains including archived. Default false.
 */
export async function getTrackedDomainsForUser(
  userId: string,
  includeArchived = false,
): Promise<TrackedDomainWithDetails[]> {
  const whereCondition = includeArchived
    ? eq(userTrackedDomains.userId, userId)
    : and(
        eq(userTrackedDomains.userId, userId),
        isNull(userTrackedDomains.archivedAt),
      );

  // and() returns SQL | undefined, but with 2+ args it always returns SQL
  return queryTrackedDomainsWithDetails(
    whereCondition as SQL,
    userTrackedDomains.createdAt,
  );
}

/**
 * Count tracked domains for a user.
 * @param includeArchived - If true, counts all domains including archived. Default false.
 */
export async function countTrackedDomainsForUser(
  userId: string,
  includeArchived = false,
): Promise<number> {
  // and() returns SQL | undefined, but with 2+ args it always returns SQL
  const whereCondition = includeArchived
    ? eq(userTrackedDomains.userId, userId)
    : (and(
        eq(userTrackedDomains.userId, userId),
        isNull(userTrackedDomains.archivedAt),
      ) as SQL);

  const [result] = await db
    .select({ count: count() })
    .from(userTrackedDomains)
    .where(whereCondition);

  return result?.count ?? 0;
}

/**
 * Count active (non-archived) tracked domains for a user.
 * Alias for countTrackedDomainsForUser(userId, false).
 */
export async function countActiveTrackedDomainsForUser(
  userId: string,
): Promise<number> {
  return countTrackedDomainsForUser(userId, false);
}

/**
 * Count archived tracked domains for a user.
 */
export async function countArchivedTrackedDomainsForUser(
  userId: string,
): Promise<number> {
  // and() returns SQL | undefined, but with 2+ args it always returns SQL
  const whereCondition = and(
    eq(userTrackedDomains.userId, userId),
    isNotNull(userTrackedDomains.archivedAt),
  ) as SQL;

  const [result] = await db
    .select({ count: count() })
    .from(userTrackedDomains)
    .where(whereCondition);

  return result?.count ?? 0;
}

/**
 * Mark a tracked domain as verified.
 * Returns null if the tracked domain doesn't exist.
 */
export async function verifyTrackedDomain(
  id: string,
  method: VerificationMethod,
) {
  const now = new Date();
  const updated = await db
    .update(userTrackedDomains)
    .set({
      verified: true,
      verificationMethod: method,
      verificationStatus: "verified",
      verificationFailedAt: null,
      lastVerifiedAt: now,
      verifiedAt: now,
    })
    .where(eq(userTrackedDomains.id, id))
    .returning();

  return updated[0] ?? null;
}

/**
 * Update notification overrides for a tracked domain.
 * Performs a partial merge: only fields with explicit values are updated,
 * undefined fields are left unchanged.
 *
 * To reset all overrides (inherit all from global), use `resetNotificationOverrides`.
 *
 * Returns null if the tracked domain doesn't exist.
 */
export async function updateNotificationOverrides(
  id: string,
  overrides: NotificationOverrides,
) {
  // Get existing overrides to merge with new ones
  const existing = await findTrackedDomainById(id);
  if (!existing) return null;

  // Merge existing overrides with new ones
  // undefined values in new overrides means "don't change"
  // explicit values replace existing ones
  const mergedOverrides: NotificationOverrides = {
    ...existing.notificationOverrides,
  };

  if (overrides.domainExpiry !== undefined) {
    mergedOverrides.domainExpiry = overrides.domainExpiry;
  }
  if (overrides.certificateExpiry !== undefined) {
    mergedOverrides.certificateExpiry = overrides.certificateExpiry;
  }
  if (overrides.verificationStatus !== undefined) {
    mergedOverrides.verificationStatus = overrides.verificationStatus;
  }

  const updated = await db
    .update(userTrackedDomains)
    .set({ notificationOverrides: mergedOverrides })
    .where(eq(userTrackedDomains.id, id))
    .returning();

  logger.info("updated notification overrides", {
    trackedDomainId: id,
    overrides: mergedOverrides,
  });

  return updated[0] ?? null;
}

/**
 * Reset all notification overrides for a tracked domain.
 * Domain will inherit all settings from global preferences.
 * Returns null if the tracked domain doesn't exist.
 */
export async function resetNotificationOverrides(id: string) {
  const updated = await db
    .update(userTrackedDomains)
    .set({ notificationOverrides: {} })
    .where(eq(userTrackedDomains.id, id))
    .returning();

  if (updated.length === 0) {
    return null;
  }

  logger.info("reset notification overrides", { trackedDomainId: id });

  return updated[0];
}

/**
 * Delete a tracked domain.
 */
export async function deleteTrackedDomain(id: string) {
  try {
    await db.delete(userTrackedDomains).where(eq(userTrackedDomains.id, id));
    return true;
  } catch (err) {
    logger.error("failed to delete tracked domain", err, { id });
    return false;
  }
}

export type TrackedDomainForNotification = {
  id: string;
  userId: string;
  domainId: string;
  domainName: string;
  notificationOverrides: NotificationOverrides;
  expirationDate: Date | string | null;
  registrar: string | null;
  userEmail: string;
  userName: string;
};

export type TrackedDomainForReverification = {
  id: string;
  userId: string;
  domainName: string;
  verificationToken: string;
  verificationMethod: VerificationMethod;
  verificationStatus: VerificationStatusType;
  verificationFailedAt: Date | null;
  notificationOverrides: NotificationOverrides;
  userEmail: string;
  userName: string;
};

/**
 * Get all verified tracked domains with expiration dates for notification processing.
 * Returns all verified, non-archived domains - filtering by notification preferences happens at processing time.
 * Archived domains are excluded since archiving pauses monitoring.
 */
export async function getVerifiedTrackedDomainsWithExpiry(): Promise<
  TrackedDomainForNotification[]
> {
  const registrarProvider = alias(providers, "registrar_provider");

  const rows = await db
    .select({
      id: userTrackedDomains.id,
      userId: userTrackedDomains.userId,
      domainId: userTrackedDomains.domainId,
      domainName: domains.name,
      notificationOverrides: userTrackedDomains.notificationOverrides,
      expirationDate: registrations.expirationDate,
      registrar: registrarProvider.name,
      userEmail: users.email,
      userName: users.name,
    })
    .from(userTrackedDomains)
    .innerJoin(domains, eq(userTrackedDomains.domainId, domains.id))
    .innerJoin(registrations, eq(domains.id, registrations.domainId))
    .innerJoin(users, eq(userTrackedDomains.userId, users.id))
    .leftJoin(
      registrarProvider,
      eq(registrations.registrarProviderId, registrarProvider.id),
    )
    .where(
      and(
        eq(userTrackedDomains.verified, true),
        isNull(userTrackedDomains.archivedAt),
      ),
    );

  return rows;
}

/**
 * Get all verified domains for re-verification.
 * Only returns domains with a verification method set.
 * Archived domains are excluded since archiving pauses monitoring.
 */
export async function getVerifiedDomainsForReverification(): Promise<
  TrackedDomainForReverification[]
> {
  const rows = await db
    .select({
      id: userTrackedDomains.id,
      userId: userTrackedDomains.userId,
      domainName: domains.name,
      verificationToken: userTrackedDomains.verificationToken,
      verificationMethod: userTrackedDomains.verificationMethod,
      verificationStatus: userTrackedDomains.verificationStatus,
      verificationFailedAt: userTrackedDomains.verificationFailedAt,
      notificationOverrides: userTrackedDomains.notificationOverrides,
      userEmail: users.email,
      userName: users.name,
    })
    .from(userTrackedDomains)
    .innerJoin(domains, eq(userTrackedDomains.domainId, domains.id))
    .innerJoin(users, eq(userTrackedDomains.userId, users.id))
    .where(
      and(
        eq(userTrackedDomains.verified, true),
        isNull(userTrackedDomains.archivedAt),
      ),
    );

  // Filter out domains without a verification method (shouldn't happen, but safe)
  return rows.filter(
    (row): row is TrackedDomainForReverification =>
      row.verificationMethod !== null,
  );
}

export type PendingDomainForAutoVerification = {
  id: string;
  userId: string;
  domainName: string;
  verificationToken: string;
  createdAt: Date;
  userEmail: string;
  userName: string;
};

/**
 * Get all pending (unverified) domains that might have added verification.
 * These are domains where the user started the add flow but never clicked "Verify".
 *
 * Note: This excludes domains that were previously verified and then revoked
 * (those have verificationStatus = 'unverified' but may have had verificationFailedAt set).
 * We only want truly new pending domains that have never been verified.
 * Archived domains are excluded since archiving pauses monitoring.
 */
export async function getPendingDomainsForAutoVerification(): Promise<
  PendingDomainForAutoVerification[]
> {
  const rows = await db
    .select({
      id: userTrackedDomains.id,
      userId: userTrackedDomains.userId,
      domainName: domains.name,
      verificationToken: userTrackedDomains.verificationToken,
      createdAt: userTrackedDomains.createdAt,
      userEmail: users.email,
      userName: users.name,
    })
    .from(userTrackedDomains)
    .innerJoin(domains, eq(userTrackedDomains.domainId, domains.id))
    .innerJoin(users, eq(userTrackedDomains.userId, users.id))
    .where(
      and(
        eq(userTrackedDomains.verified, false),
        // Exclude revoked domains (those that were previously verified)
        isNull(userTrackedDomains.verifiedAt),
        // Exclude archived domains (archiving pauses monitoring)
        isNull(userTrackedDomains.archivedAt),
      ),
    );

  return rows;
}

/**
 * Mark a domain's verification as successful.
 * Updates lastVerifiedAt and clears any failing status.
 * Returns null if the tracked domain doesn't exist.
 */
export async function markVerificationSuccessful(id: string) {
  const updated = await db
    .update(userTrackedDomains)
    .set({
      verificationStatus: "verified",
      verificationFailedAt: null,
      lastVerifiedAt: new Date(),
    })
    .where(eq(userTrackedDomains.id, id))
    .returning();

  return updated[0] ?? null;
}

/**
 * Mark a domain's verification as failing.
 * Sets status to 'failing' and records when the failure started (if not already set).
 * Returns null if the tracked domain doesn't exist.
 */
export async function markVerificationFailing(id: string) {
  // First check if this is a new failure or an existing one
  const existing = await findTrackedDomainById(id);
  if (!existing) return null;

  const updated = await db
    .update(userTrackedDomains)
    .set({
      verificationStatus: "failing",
      // Only set verificationFailedAt if it's not already set (first failure)
      verificationFailedAt: existing.verificationFailedAt ?? new Date(),
    })
    .where(eq(userTrackedDomains.id, id))
    .returning();

  return updated[0] ?? null;
}

/**
 * Revoke a domain's verification.
 * Sets verified to false and status to 'unverified'.
 * Returns null if the tracked domain doesn't exist.
 */
export async function revokeVerification(id: string) {
  const updated = await db
    .update(userTrackedDomains)
    .set({
      verified: false,
      verificationStatus: "unverified",
      verificationFailedAt: null,
    })
    .where(eq(userTrackedDomains.id, id))
    .returning();

  if (updated.length === 0) {
    return null;
  }

  logger.info("verification revoked", { trackedDomainId: id });
  return updated[0];
}

// ============================================================================
// Archive/Unarchive Functions
// ============================================================================

/**
 * Archive a tracked domain.
 * Archived domains are soft-deleted and don't count against user's limit.
 * Returns null if the tracked domain doesn't exist.
 */
export async function archiveTrackedDomain(id: string) {
  const updated = await db
    .update(userTrackedDomains)
    .set({ archivedAt: new Date() })
    .where(eq(userTrackedDomains.id, id))
    .returning();

  if (updated.length === 0) {
    return null;
  }

  logger.info("tracked domain archived", { trackedDomainId: id });
  return updated[0];
}

/**
 * Unarchive (reactivate) a tracked domain.
 * Returns null if the tracked domain doesn't exist.
 */
export async function unarchiveTrackedDomain(id: string) {
  const updated = await db
    .update(userTrackedDomains)
    .set({ archivedAt: null })
    .where(eq(userTrackedDomains.id, id))
    .returning();

  if (updated.length === 0) {
    return null;
  }

  logger.info("tracked domain unarchived", { trackedDomainId: id });
  return updated[0];
}

/**
 * Archive the oldest active domains for a user.
 * Used when downgrading to enforce tier limits.
 * @param userId - The user ID
 * @param count - Number of domains to archive
 * @returns Number of domains actually archived
 */
export async function archiveOldestActiveDomains(
  userId: string,
  countToArchive: number,
): Promise<number> {
  if (countToArchive <= 0) return 0;

  // Find the oldest active domains
  const domainsToArchive = await db
    .select({ id: userTrackedDomains.id })
    .from(userTrackedDomains)
    .where(
      and(
        eq(userTrackedDomains.userId, userId),
        isNull(userTrackedDomains.archivedAt),
      ),
    )
    .orderBy(asc(userTrackedDomains.createdAt))
    .limit(countToArchive);

  if (domainsToArchive.length === 0) return 0;

  const idsToArchive = domainsToArchive.map((d) => d.id);

  // Archive all domains in a single batch update
  const result = await db
    .update(userTrackedDomains)
    .set({ archivedAt: new Date() })
    .where(inArray(userTrackedDomains.id, idsToArchive))
    .returning({ id: userTrackedDomains.id });

  const archivedCount = result.length;

  logger.info("archived oldest active domains", {
    userId,
    requested: countToArchive,
    archived: archivedCount,
  });

  return archivedCount;
}

/**
 * Get all archived domains for a user.
 */
export async function getArchivedDomainsForUser(
  userId: string,
): Promise<TrackedDomainWithDetails[]> {
  const whereCondition = and(
    eq(userTrackedDomains.userId, userId),
    isNotNull(userTrackedDomains.archivedAt),
  );

  // and() returns SQL | undefined, but with 2+ args it always returns SQL
  return queryTrackedDomainsWithDetails(
    whereCondition as SQL,
    userTrackedDomains.archivedAt,
  );
}

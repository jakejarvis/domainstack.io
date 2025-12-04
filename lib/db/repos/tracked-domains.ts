import "server-only";

import { and, eq } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { db } from "@/lib/db/client";
import {
  domains,
  hosting,
  providers,
  registrations,
  trackedDomains,
  users,
  type verificationMethod,
  type verificationStatus,
} from "@/lib/db/schema";
import { createLogger } from "@/lib/logger/server";

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
  notifyDomainExpiry: boolean;
  notifyVerificationFailing: boolean;
  createdAt: Date;
  verifiedAt: Date | null;
  expirationDate: Date | null;
  registrar: ProviderInfo;
  dns: ProviderInfo;
  hosting: ProviderInfo;
  email: ProviderInfo;
};

/**
 * Create a new tracked domain record.
 */
export async function createTrackedDomain(params: CreateTrackedDomainParams) {
  const { userId, domainId, verificationToken, verificationMethod } = params;

  const inserted = await db
    .insert(trackedDomains)
    .values({
      userId,
      domainId,
      verificationToken,
      verificationMethod,
    })
    .returning();

  return inserted[0];
}

/**
 * Find a tracked domain by user and domain ID.
 */
export async function findTrackedDomain(userId: string, domainId: string) {
  const rows = await db
    .select()
    .from(trackedDomains)
    .where(
      and(
        eq(trackedDomains.userId, userId),
        eq(trackedDomains.domainId, domainId),
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
    .from(trackedDomains)
    .where(eq(trackedDomains.id, id))
    .limit(1);

  return rows[0] ?? null;
}

/**
 * Get all tracked domains for a user with domain details.
 */
export async function getTrackedDomainsForUser(
  userId: string,
): Promise<TrackedDomainWithDetails[]> {
  // Create aliases for the providers table (joined multiple times)
  const registrarProvider = alias(providers, "registrar_provider");
  const dnsProvider = alias(providers, "dns_provider");
  const hostingProvider = alias(providers, "hosting_provider");
  const emailProvider = alias(providers, "email_provider");

  const rows = await db
    .select({
      id: trackedDomains.id,
      userId: trackedDomains.userId,
      domainId: trackedDomains.domainId,
      domainName: domains.name,
      verified: trackedDomains.verified,
      verificationMethod: trackedDomains.verificationMethod,
      verificationToken: trackedDomains.verificationToken,
      verificationStatus: trackedDomains.verificationStatusEnum,
      verificationFailedAt: trackedDomains.verificationFailedAt,
      lastVerifiedAt: trackedDomains.lastVerifiedAt,
      notifyDomainExpiry: trackedDomains.notifyDomainExpiry,
      notifyVerificationFailing: trackedDomains.notifyVerificationFailing,
      createdAt: trackedDomains.createdAt,
      verifiedAt: trackedDomains.verifiedAt,
      expirationDate: registrations.expirationDate,
      // Registrar from registrations table
      registrarName: registrarProvider.name,
      registrarDomain: registrarProvider.domain,
      // DNS, Hosting, Email from hosting table
      dnsName: dnsProvider.name,
      dnsDomain: dnsProvider.domain,
      hostingName: hostingProvider.name,
      hostingDomain: hostingProvider.domain,
      emailName: emailProvider.name,
      emailDomain: emailProvider.domain,
    })
    .from(trackedDomains)
    .innerJoin(domains, eq(trackedDomains.domainId, domains.id))
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
    .where(eq(trackedDomains.userId, userId))
    .orderBy(trackedDomains.createdAt);

  // Transform flat rows into nested structure
  return rows.map((row) => ({
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
    notifyDomainExpiry: row.notifyDomainExpiry,
    notifyVerificationFailing: row.notifyVerificationFailing,
    createdAt: row.createdAt,
    verifiedAt: row.verifiedAt,
    expirationDate: row.expirationDate,
    registrar: { name: row.registrarName, domain: row.registrarDomain },
    dns: { name: row.dnsName, domain: row.dnsDomain },
    hosting: { name: row.hostingName, domain: row.hostingDomain },
    email: { name: row.emailName, domain: row.emailDomain },
  }));
}

/**
 * Count tracked domains for a user.
 */
export async function countTrackedDomainsForUser(userId: string) {
  const rows = await db
    .select()
    .from(trackedDomains)
    .where(eq(trackedDomains.userId, userId));

  return rows.length;
}

/**
 * Mark a tracked domain as verified.
 */
export async function verifyTrackedDomain(
  id: string,
  method: VerificationMethod,
) {
  const now = new Date();
  const updated = await db
    .update(trackedDomains)
    .set({
      verified: true,
      verificationMethod: method,
      verificationStatusEnum: "verified",
      verificationFailedAt: null,
      lastVerifiedAt: now,
      verifiedAt: now,
    })
    .where(eq(trackedDomains.id, id))
    .returning();

  return updated[0];
}

/**
 * Update notification preferences for a tracked domain.
 */
export async function updateTrackedDomainNotifications(
  id: string,
  notifyDomainExpiry: boolean,
) {
  const updated = await db
    .update(trackedDomains)
    .set({ notifyDomainExpiry })
    .where(eq(trackedDomains.id, id))
    .returning();

  return updated[0];
}

/**
 * Delete a tracked domain.
 */
export async function deleteTrackedDomain(id: string) {
  try {
    await db.delete(trackedDomains).where(eq(trackedDomains.id, id));
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
  notifyDomainExpiry: boolean;
  notifyVerificationFailing: boolean;
  expirationDate: Date | string | null;
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
  notifyVerificationFailing: boolean;
  userEmail: string;
  userName: string;
};

/**
 * Get all verified tracked domains with expiration dates for notification processing.
 */
export async function getVerifiedTrackedDomainsWithExpiry(): Promise<
  TrackedDomainForNotification[]
> {
  const rows = await db
    .select({
      id: trackedDomains.id,
      userId: trackedDomains.userId,
      domainId: trackedDomains.domainId,
      domainName: domains.name,
      notifyDomainExpiry: trackedDomains.notifyDomainExpiry,
      notifyVerificationFailing: trackedDomains.notifyVerificationFailing,
      expirationDate: registrations.expirationDate,
      userEmail: users.email,
      userName: users.name,
    })
    .from(trackedDomains)
    .innerJoin(domains, eq(trackedDomains.domainId, domains.id))
    .innerJoin(registrations, eq(domains.id, registrations.domainId))
    .innerJoin(users, eq(trackedDomains.userId, users.id))
    .where(
      and(
        eq(trackedDomains.verified, true),
        eq(trackedDomains.notifyDomainExpiry, true),
      ),
    );

  return rows;
}

/**
 * Get all verified domains for re-verification.
 * Only returns domains with a verification method set.
 */
export async function getVerifiedDomainsForReverification(): Promise<
  TrackedDomainForReverification[]
> {
  const rows = await db
    .select({
      id: trackedDomains.id,
      userId: trackedDomains.userId,
      domainName: domains.name,
      verificationToken: trackedDomains.verificationToken,
      verificationMethod: trackedDomains.verificationMethod,
      verificationStatus: trackedDomains.verificationStatusEnum,
      verificationFailedAt: trackedDomains.verificationFailedAt,
      notifyVerificationFailing: trackedDomains.notifyVerificationFailing,
      userEmail: users.email,
      userName: users.name,
    })
    .from(trackedDomains)
    .innerJoin(domains, eq(trackedDomains.domainId, domains.id))
    .innerJoin(users, eq(trackedDomains.userId, users.id))
    .where(eq(trackedDomains.verified, true));

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
 */
export async function getPendingDomainsForAutoVerification(): Promise<
  PendingDomainForAutoVerification[]
> {
  const rows = await db
    .select({
      id: trackedDomains.id,
      userId: trackedDomains.userId,
      domainName: domains.name,
      verificationToken: trackedDomains.verificationToken,
      createdAt: trackedDomains.createdAt,
      userEmail: users.email,
      userName: users.name,
    })
    .from(trackedDomains)
    .innerJoin(domains, eq(trackedDomains.domainId, domains.id))
    .innerJoin(users, eq(trackedDomains.userId, users.id))
    .where(eq(trackedDomains.verified, false));

  return rows;
}

/**
 * Mark a domain's verification as successful.
 * Updates lastVerifiedAt and clears any failing status.
 */
export async function markVerificationSuccessful(id: string) {
  const updated = await db
    .update(trackedDomains)
    .set({
      verificationStatusEnum: "verified",
      verificationFailedAt: null,
      lastVerifiedAt: new Date(),
    })
    .where(eq(trackedDomains.id, id))
    .returning();

  return updated[0];
}

/**
 * Mark a domain's verification as failing.
 * Sets status to 'failing' and records when the failure started (if not already set).
 */
export async function markVerificationFailing(id: string) {
  // First check if this is a new failure or an existing one
  const existing = await findTrackedDomainById(id);
  if (!existing) return null;

  const updated = await db
    .update(trackedDomains)
    .set({
      verificationStatusEnum: "failing",
      // Only set verificationFailedAt if it's not already set (first failure)
      verificationFailedAt: existing.verificationFailedAt ?? new Date(),
    })
    .where(eq(trackedDomains.id, id))
    .returning();

  return updated[0];
}

/**
 * Revoke a domain's verification.
 * Sets verified to false and status to 'unverified'.
 */
export async function revokeVerification(id: string) {
  const updated = await db
    .update(trackedDomains)
    .set({
      verified: false,
      verificationStatusEnum: "unverified",
      verificationFailedAt: null,
    })
    .where(eq(trackedDomains.id, id))
    .returning();

  logger.info("verification revoked", { trackedDomainId: id });
  return updated[0];
}

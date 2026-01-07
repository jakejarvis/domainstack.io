import "server-only";

import type { SQL } from "drizzle-orm";
import {
  and,
  asc,
  count,
  eq,
  inArray,
  isNotNull,
  isNull,
  lt,
} from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { db } from "@/lib/db/client";
import {
  certificates,
  dnsRecords,
  domains,
  hosting,
  providers,
  registrations,
  users,
  userTrackedDomains,
} from "@/lib/db/schema";
import { INNGEST_EVENTS } from "@/lib/inngest/events";
import { createLogger } from "@/lib/logger/server";
import type {
  DnsRecord,
  NotificationOverrides,
  ProviderInfo,
  RegistrationContacts,
  VerificationMethod,
  VerificationStatus,
} from "@/lib/types";

const logger = createLogger({ source: "tracked-domains" });

export type CreateTrackedDomainParams = {
  userId: string;
  domainId: string;
  verificationToken: string;
  verificationMethod?: VerificationMethod;
};

export type TrackedDomainWithDetails = {
  id: string;
  userId: string;
  domainId: string;
  domainName: string;
  tld: string;
  verified: boolean;
  verificationMethod: VerificationMethod | null;
  verificationToken: string;
  verificationStatus: VerificationStatus;
  verificationFailedAt: Date | null;
  lastVerifiedAt: Date | null;
  notificationOverrides: NotificationOverrides;
  createdAt: Date;
  verifiedAt: Date | null;
  archivedAt: Date | null;
  expirationDate: Date | null;
  registrationDate: Date | null;
  registrar: ProviderInfo;
  dns: ProviderInfo;
  hosting: ProviderInfo;
  email: ProviderInfo;
  ca: ProviderInfo;
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
    return null;
  }

  return inserted[0];
}

export type CreateTrackedDomainWithLimitCheckResult =
  | { success: true; trackedDomain: typeof userTrackedDomains.$inferSelect }
  | { success: false; reason: "limit_exceeded" | "already_exists" };

/**
 * Create a new tracked domain record with atomic limit checking.
 * Uses a transaction to prevent race conditions where multiple concurrent
 * requests could exceed the user's domain limit.
 *
 * @returns Object indicating success or failure reason
 */
export async function createTrackedDomainWithLimitCheck(
  params: CreateTrackedDomainParams & { maxDomains: number },
): Promise<CreateTrackedDomainWithLimitCheckResult> {
  const {
    userId,
    domainId,
    verificationToken,
    verificationMethod,
    maxDomains,
  } = params;

  return await db.transaction(async (tx) => {
    // Count active (non-archived) domains for this user within the transaction
    const [countResult] = await tx
      .select({ count: count() })
      .from(userTrackedDomains)
      .where(
        and(
          eq(userTrackedDomains.userId, userId),
          isNull(userTrackedDomains.archivedAt),
        ),
      );

    const currentCount = countResult?.count ?? 0;

    // Check if adding would exceed limit
    if (currentCount >= maxDomains) {
      return { success: false, reason: "limit_exceeded" } as const;
    }

    // Insert the new tracked domain
    const inserted = await tx
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
      return { success: false, reason: "already_exists" } as const;
    }

    return { success: true, trackedDomain: inserted[0] } as const;
  });
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
  verificationStatus: VerificationStatus;
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
  tld: string;
  verified: boolean;
  verificationMethod: VerificationMethod | null;
  verificationToken: string;
  verificationStatus: VerificationStatus;
  verificationFailedAt: Date | null;
  lastVerifiedAt: Date | null;
  notificationOverrides: NotificationOverrides;
  createdAt: Date;
  verifiedAt: Date | null;
  archivedAt: Date | null;
  expirationDate: Date | null;
  registrationDate: Date | null;
  registrarId: string | null;
  registrarName: string | null;
  registrarDomain: string | null;
  dnsId: string | null;
  dnsName: string | null;
  dnsDomain: string | null;
  hostingId: string | null;
  hostingName: string | null;
  hostingDomain: string | null;
  emailId: string | null;
  emailName: string | null;
  emailDomain: string | null;
  caId: string | null;
  caName: string | null;
  caDomain: string | null;
  certificateExpiryDate: Date | null;
  registrationWhoisServer: string | null;
  registrationRdapServers: string[] | null;
  registrationSource: "rdap" | "whois" | null;
  registrationTransferLock: boolean | null;
  registrationPrivacyEnabled: boolean | null;
  registrationContacts: RegistrationContacts | null;
};

/**
 * Empty provider info returned for unverified domains.
 * This ensures domain details are not leaked before ownership is verified.
 */
const EMPTY_PROVIDER_INFO: ProviderInfo = {
  id: null,
  name: null,
  domain: null,
};

/**
 * Empty registrar info for unverified domains.
 * Includes all registrar-specific fields set to null.
 */
const EMPTY_REGISTRAR_INFO: ProviderInfo = {
  ...EMPTY_PROVIDER_INFO,
  whoisServer: null,
  rdapServers: null,
  registrationSource: null,
  transferLock: null,
  registrantInfo: {
    privacyEnabled: null,
    contacts: null,
  },
};

/**
 * Empty CA info for unverified domains.
 * Includes the certificate expiry date field set to null.
 */
const EMPTY_CA_INFO: ProviderInfo = {
  ...EMPTY_PROVIDER_INFO,
  certificateExpiryDate: null,
};

/**
 * Transform flat query rows into nested TrackedDomainWithDetails structure.
 * For unverified domains, sensitive data (provider info, dates) is nulled out
 * to prevent leaking domain details before ownership is verified.
 */
function transformToTrackedDomainWithDetails(
  row: TrackedDomainRow,
): TrackedDomainWithDetails {
  // For unverified domains, return null/empty for all domain details
  // This is a defense-in-depth measure to prevent data leakage, even though none of this is technically private
  if (!row.verified) {
    return {
      id: row.id,
      userId: row.userId,
      domainId: row.domainId,
      domainName: row.domainName,
      tld: row.tld,
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
      // Null out all domain details for unverified domains
      expirationDate: null,
      registrationDate: null,
      registrar: { ...EMPTY_REGISTRAR_INFO },
      dns: { ...EMPTY_PROVIDER_INFO },
      hosting: { ...EMPTY_PROVIDER_INFO },
      email: { ...EMPTY_PROVIDER_INFO },
      ca: { ...EMPTY_CA_INFO },
    };
  }

  // Verified domains get full details
  return {
    id: row.id,
    userId: row.userId,
    domainId: row.domainId,
    domainName: row.domainName,
    tld: row.tld,
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
    registrationDate: row.registrationDate,
    registrar: {
      id: row.registrarId,
      name: row.registrarName,
      domain: row.registrarDomain,
      whoisServer: row.registrationWhoisServer,
      rdapServers: row.registrationRdapServers,
      registrationSource: row.registrationSource,
      transferLock: row.registrationTransferLock,
      registrantInfo: {
        privacyEnabled: row.registrationPrivacyEnabled,
        contacts: row.registrationContacts,
      },
    },
    dns: { id: row.dnsId, name: row.dnsName, domain: row.dnsDomain },
    hosting: {
      id: row.hostingId,
      name: row.hostingName,
      domain: row.hostingDomain,
    },
    email: { id: row.emailId, name: row.emailName, domain: row.emailDomain },
    ca: {
      id: row.caId,
      name: row.caName,
      domain: row.caDomain,
      certificateExpiryDate: row.certificateExpiryDate,
    },
  };
}

/**
 * Deduplicate tooltip records by value and priority.
 * Case-insensitive comparison for consistent deduplication.
 */
function deduplicateTooltipRecords(records: DnsRecord[]): DnsRecord[] {
  const seen = new Set<string>();
  const deduplicated: DnsRecord[] = [];

  for (const r of records) {
    const key = `${r.value.trim().toLowerCase()}|${r.priority ?? ""}`;
    if (!seen.has(key)) {
      seen.add(key);
      deduplicated.push(r);
    }
  }

  return deduplicated;
}

/**
 * Fetch DNS records for multiple domains and group them by domain ID and type.
 * Returns a map of domainId → type → records for efficient lookup.
 */
async function fetchDnsRecordsForDomains(domainIds: string[]): Promise<
  Map<
    string,
    {
      hosting: DnsRecord[];
      email: DnsRecord[];
      dns: DnsRecord[];
    }
  >
> {
  if (domainIds.length === 0) {
    return new Map();
  }

  // Fetch all relevant DNS records in a single query
  const records = await db
    .select({
      domainId: dnsRecords.domainId,
      type: dnsRecords.type,
      name: dnsRecords.name,
      value: dnsRecords.value,
      priority: dnsRecords.priority,
    })
    .from(dnsRecords)
    .where(
      and(
        inArray(dnsRecords.domainId, domainIds),
        inArray(dnsRecords.type, ["A", "AAAA", "MX", "NS"]),
      ),
    );

  // Group records by domain ID and type
  const recordsByDomain = new Map<
    string,
    {
      hosting: DnsRecord[];
      email: DnsRecord[];
      dns: DnsRecord[];
    }
  >();

  for (const record of records) {
    // Get or create the groups for this domain
    let groups = recordsByDomain.get(record.domainId);
    if (!groups) {
      groups = {
        hosting: [],
        email: [],
        dns: [],
      };
      recordsByDomain.set(record.domainId, groups);
    }

    const dnsRecord: DnsRecord = {
      type: record.type,
      name: record.name,
      value: record.value,
      ...(record.priority != null && { priority: record.priority }),
    };

    if (record.type === "A" || record.type === "AAAA") {
      groups.hosting.push(dnsRecord);
    } else if (record.type === "MX") {
      groups.email.push(dnsRecord);
    } else if (record.type === "NS") {
      groups.dns.push(dnsRecord);
    }
  }

  // Deduplicate and sort records within each group
  for (const groups of recordsByDomain.values()) {
    // Sort A/AAAA records (hosting) alphabetically by value
    groups.hosting = deduplicateTooltipRecords(groups.hosting).sort((a, b) =>
      a.value.localeCompare(b.value),
    );
    // Sort NS records (dns) alphabetically by value
    groups.dns = deduplicateTooltipRecords(groups.dns).sort((a, b) =>
      a.value.localeCompare(b.value),
    );
    // Sort MX records (email) by priority, then alphabetically by value
    groups.email = deduplicateTooltipRecords(groups.email).sort((a, b) => {
      const priorityA = a.priority ?? Number.MAX_SAFE_INTEGER;
      const priorityB = b.priority ?? Number.MAX_SAFE_INTEGER;
      if (priorityA !== priorityB) return priorityA - priorityB;
      return a.value.localeCompare(b.value);
    });
  }

  return recordsByDomain;
}

/**
 * Attach DNS records to tracked domain results.
 */
async function attachDnsRecords(
  domains: TrackedDomainWithDetails[],
): Promise<TrackedDomainWithDetails[]> {
  if (domains.length === 0) {
    return domains;
  }

  const domainIds = domains.map((d) => d.domainId);
  const recordsByDomain = await fetchDnsRecordsForDomains(domainIds);

  return domains.map((domain) => {
    const records = recordsByDomain.get(domain.domainId);
    if (!records) {
      return domain;
    }

    return {
      ...domain,
      hosting: { ...domain.hosting, records: records.hosting },
      email: { ...domain.email, records: records.email },
      dns: { ...domain.dns, records: records.dns },
    };
  });
}

type QueryTrackedDomainsOptions = {
  /** Whether to include DNS records (requires additional query). Default true. */
  includeDnsRecords?: boolean;
  /** Whether to include archived domains. Default false. */
  includeArchived?: boolean;
};

/**
 * Internal helper to query tracked domains with full details.
 * Centralizes the complex select/join logic used by multiple public functions.
 */
async function queryTrackedDomainsWithDetails(
  whereCondition: SQL,
  orderByColumn:
    | typeof userTrackedDomains.createdAt
    | typeof userTrackedDomains.archivedAt,
  options: QueryTrackedDomainsOptions = {},
): Promise<TrackedDomainWithDetails[]> {
  const { includeDnsRecords = true } = options;

  // Create aliases for the providers table (joined multiple times)
  const registrarProvider = alias(providers, "registrar_provider");
  const dnsProvider = alias(providers, "dns_provider");
  const hostingProvider = alias(providers, "hosting_provider");
  const emailProvider = alias(providers, "email_provider");
  const caProvider = alias(providers, "ca_provider");

  // Subquery to get the leaf certificate per domain (expires first)
  // Leaf certificates expire before intermediate/root certificates in the chain
  const latestCertificate = db
    .selectDistinctOn([certificates.domainId], {
      domainId: certificates.domainId,
      caProviderId: certificates.caProviderId,
      validTo: certificates.validTo,
    })
    .from(certificates)
    .orderBy(certificates.domainId, certificates.validTo)
    .as("latest_certificate");

  const rows = await db
    .select({
      id: userTrackedDomains.id,
      userId: userTrackedDomains.userId,
      domainId: userTrackedDomains.domainId,
      domainName: domains.name,
      tld: domains.tld,
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
      registrationDate: registrations.creationDate,
      registrarId: registrarProvider.id,
      registrarName: registrarProvider.name,
      registrarDomain: registrarProvider.domain,
      dnsId: dnsProvider.id,
      dnsName: dnsProvider.name,
      dnsDomain: dnsProvider.domain,
      hostingId: hostingProvider.id,
      hostingName: hostingProvider.name,
      hostingDomain: hostingProvider.domain,
      emailId: emailProvider.id,
      emailName: emailProvider.name,
      emailDomain: emailProvider.domain,
      caId: caProvider.id,
      caName: caProvider.name,
      caDomain: caProvider.domain,
      certificateExpiryDate: latestCertificate.validTo,
      registrationWhoisServer: registrations.whoisServer,
      registrationRdapServers: registrations.rdapServers,
      registrationSource: registrations.source,
      registrationTransferLock: registrations.transferLock,
      registrationPrivacyEnabled: registrations.privacyEnabled,
      registrationContacts: registrations.contacts,
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
    .leftJoin(latestCertificate, eq(domains.id, latestCertificate.domainId))
    .leftJoin(caProvider, eq(latestCertificate.caProviderId, caProvider.id))
    .where(whereCondition)
    .orderBy(orderByColumn);

  const domainsWithoutRecords = rows.map(transformToTrackedDomainWithDetails);

  return includeDnsRecords
    ? attachDnsRecords(domainsWithoutRecords)
    : domainsWithoutRecords;
}

export type GetTrackedDomainsOptions = {
  /** If true, returns all domains including archived. Default false. */
  includeArchived?: boolean;
  /** If true, includes DNS records (requires additional query). Default true. */
  includeDnsRecords?: boolean;
};

/**
 * Get all tracked domains for a user with domain details.
 * @param options.includeArchived - If true, returns all domains including archived. Default false.
 * @param options.includeDnsRecords - If true, includes DNS records. Default true.
 */
export async function getTrackedDomainsForUser(
  userId: string,
  options: GetTrackedDomainsOptions | boolean = {},
): Promise<TrackedDomainWithDetails[]> {
  // Handle legacy boolean parameter for backward compatibility
  const opts =
    typeof options === "boolean" ? { includeArchived: options } : options;
  const { includeArchived = false, includeDnsRecords = true } = opts;

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
    { includeDnsRecords },
  );
}

/**
 * Get a single tracked domain with full details including DNS records.
 * Ensures the domain is owned by the specified user.
 *
 * @param userId - The user ID (for ownership verification)
 * @param trackedDomainId - The tracked domain ID to fetch
 * @returns TrackedDomainWithDetails or null if not found or not owned by user
 */
export async function getTrackedDomainDetails(
  userId: string,
  trackedDomainId: string,
): Promise<TrackedDomainWithDetails | null> {
  const whereCondition = and(
    eq(userTrackedDomains.id, trackedDomainId),
    eq(userTrackedDomains.userId, userId),
  ) as SQL;

  const results = await queryTrackedDomainsWithDetails(
    whereCondition,
    userTrackedDomains.createdAt,
    { includeDnsRecords: true },
  );

  return results[0] ?? null;
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

export type TrackedDomainCounts = {
  active: number;
  archived: number;
};

/**
 * Count active and archived tracked domains for a user.
 * Runs both count queries in parallel for efficiency.
 * More efficient than calling countActiveTrackedDomainsForUser and
 * countArchivedTrackedDomainsForUser sequentially.
 */
export async function countTrackedDomainsByStatus(
  userId: string,
): Promise<TrackedDomainCounts> {
  const userCondition = eq(userTrackedDomains.userId, userId);

  // Run both count queries in parallel using type-safe Drizzle functions
  const [activeResult, archivedResult] = await Promise.all([
    db
      .select({ count: count() })
      .from(userTrackedDomains)
      .where(and(userCondition, isNull(userTrackedDomains.archivedAt))),
    db
      .select({ count: count() })
      .from(userTrackedDomains)
      .where(and(userCondition, isNotNull(userTrackedDomains.archivedAt))),
  ]);

  return {
    active: activeResult[0]?.count ?? 0,
    archived: archivedResult[0]?.count ?? 0,
  };
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

  // After verification, initialize snapshot for change detection
  // This is done in the background to avoid blocking the user
  if (updated[0]) {
    // Import dynamically to avoid circular dependencies
    import("@/lib/inngest/client")
      .then(({ inngest }) => {
        inngest.send({
          name: INNGEST_EVENTS.SNAPSHOT_INITIALIZE,
          data: {
            trackedDomainId: updated[0].id,
            domainId: updated[0].domainId,
          },
        });
      })
      .catch((err) => {
        logger.error(
          {
            err,
            trackedDomainId: updated[0].id,
            domainId: updated[0].domainId,
          },
          "failed to trigger snapshot initialization for domain",
        );
      });
  }

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
  if (overrides.registrationChanges !== undefined) {
    mergedOverrides.registrationChanges = overrides.registrationChanges;
  }
  if (overrides.providerChanges !== undefined) {
    mergedOverrides.providerChanges = overrides.providerChanges;
  }
  if (overrides.certificateChanges !== undefined) {
    mergedOverrides.certificateChanges = overrides.certificateChanges;
  }

  const updated = await db
    .update(userTrackedDomains)
    .set({ notificationOverrides: mergedOverrides })
    .where(eq(userTrackedDomains.id, id))
    .returning();

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
    logger.error(
      { err, trackedDomainId: id },
      "failed to delete tracked domain",
    );
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
  verificationStatus: VerificationStatus;
  verificationFailedAt: Date | null;
  notificationOverrides: NotificationOverrides;
  userEmail: string;
  userName: string;
};

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
 * Get verified tracked domain IDs.
 * Used by the reverification scheduler.
 */
export async function getVerifiedTrackedDomainIds(): Promise<string[]> {
  const rows = await db
    .select({
      id: userTrackedDomains.id,
    })
    .from(userTrackedDomains)
    .where(
      and(
        eq(userTrackedDomains.verified, true),
        isNull(userTrackedDomains.archivedAt),
      ),
    );

  return rows.map((r) => r.id);
}

/**
 * Get pending tracked domain IDs.
 * Used by the reverification scheduler.
 */
export async function getPendingTrackedDomainIds(): Promise<string[]> {
  const rows = await db
    .select({
      id: userTrackedDomains.id,
    })
    .from(userTrackedDomains)
    .where(
      and(
        eq(userTrackedDomains.verified, false),
        isNull(userTrackedDomains.verifiedAt),
        isNull(userTrackedDomains.archivedAt),
      ),
    );

  return rows.map((r) => r.id);
}

/**
 * Get a single tracked domain for notification.
 * Used by the domain expiry worker.
 */
export async function getTrackedDomainForNotification(
  trackedDomainId: string,
): Promise<TrackedDomainForNotification | null> {
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
    .where(eq(userTrackedDomains.id, trackedDomainId))
    .limit(1);

  return rows[0] ?? null;
}

/**
 * Get a single tracked domain for reverification.
 * Used by the reverification worker.
 */
export async function getTrackedDomainForReverification(
  trackedDomainId: string,
): Promise<TrackedDomainForReverification | null> {
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
    .where(eq(userTrackedDomains.id, trackedDomainId))
    .limit(1);

  if (rows.length === 0 || !rows[0].verificationMethod) {
    return null;
  }

  return rows[0] as TrackedDomainForReverification;
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

  return updated[0];
}

/**
 * Unarchive (reactivate) a tracked domain.
 * Returns null if the tracked domain doesn't exist.
 *
 * NOTE: This function does NOT check limits. Use `unarchiveTrackedDomainWithLimitCheck`
 * for user-facing operations that need to respect tier limits.
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

  return updated[0];
}

export type UnarchiveTrackedDomainWithLimitCheckResult =
  | { success: true; trackedDomain: typeof userTrackedDomains.$inferSelect }
  | {
      success: false;
      reason: "not_found" | "not_archived" | "limit_exceeded" | "wrong_user";
    };

/**
 * Unarchive a tracked domain with atomic limit checking.
 * Uses a transaction to prevent race conditions where multiple concurrent
 * unarchive requests could exceed the user's domain limit.
 *
 * @param id - The tracked domain ID to unarchive
 * @param userId - The user ID (for ownership verification)
 * @param maxDomains - The user's current domain limit
 * @returns Object indicating success or failure reason
 */
export async function unarchiveTrackedDomainWithLimitCheck(
  id: string,
  userId: string,
  maxDomains: number,
): Promise<UnarchiveTrackedDomainWithLimitCheckResult> {
  return await db.transaction(async (tx) => {
    // Get the tracked domain within the transaction
    const [tracked] = await tx
      .select()
      .from(userTrackedDomains)
      .where(eq(userTrackedDomains.id, id))
      .limit(1);

    if (!tracked) {
      return { success: false, reason: "not_found" } as const;
    }

    // Verify ownership
    if (tracked.userId !== userId) {
      return { success: false, reason: "wrong_user" } as const;
    }

    // Check if actually archived
    if (!tracked.archivedAt) {
      return { success: false, reason: "not_archived" } as const;
    }

    // Count active (non-archived) domains for this user within the transaction
    const [countResult] = await tx
      .select({ count: count() })
      .from(userTrackedDomains)
      .where(
        and(
          eq(userTrackedDomains.userId, userId),
          isNull(userTrackedDomains.archivedAt),
        ),
      );

    const currentCount = countResult?.count ?? 0;

    // Check if unarchiving would exceed limit
    if (currentCount >= maxDomains) {
      return { success: false, reason: "limit_exceeded" } as const;
    }

    // Unarchive the domain
    const [updated] = await tx
      .update(userTrackedDomains)
      .set({ archivedAt: null })
      .where(eq(userTrackedDomains.id, id))
      .returning();

    return { success: true, trackedDomain: updated } as const;
  });
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

  return archivedCount;
}

export type BulkOperationResult = {
  succeeded: string[];
  alreadyProcessed: string[];
  notFound: string[];
  notOwned: string[];
};

/**
 * Bulk archive domains for a user with ownership verification.
 * Uses batch operations to avoid N+1 queries.
 *
 * @param userId - The user ID performing the action
 * @param trackedDomainIds - Array of tracked domain IDs to archive
 * @returns Object with arrays of succeeded, alreadyProcessed, notFound, and notOwned IDs
 */
export async function bulkArchiveTrackedDomains(
  userId: string,
  trackedDomainIds: string[],
): Promise<BulkOperationResult> {
  if (trackedDomainIds.length === 0) {
    return { succeeded: [], alreadyProcessed: [], notFound: [], notOwned: [] };
  }

  // 1. Fetch all requested domains in one query
  const foundDomains = await db
    .select({
      id: userTrackedDomains.id,
      userId: userTrackedDomains.userId,
      archivedAt: userTrackedDomains.archivedAt,
    })
    .from(userTrackedDomains)
    .where(inArray(userTrackedDomains.id, trackedDomainIds));

  const foundIds = new Set(foundDomains.map((d) => d.id));
  const notFound = trackedDomainIds.filter((id) => !foundIds.has(id));

  // 2. Categorize domains
  const notOwned: string[] = [];
  const alreadyProcessed: string[] = [];
  const toArchive: string[] = [];

  for (const domain of foundDomains) {
    if (domain.userId !== userId) {
      notOwned.push(domain.id);
    } else if (domain.archivedAt !== null) {
      alreadyProcessed.push(domain.id);
    } else {
      toArchive.push(domain.id);
    }
  }

  if (toArchive.length === 0) {
    return { succeeded: [], alreadyProcessed, notFound, notOwned };
  }

  // 3. Batch update in one query
  const archived = await db
    .update(userTrackedDomains)
    .set({ archivedAt: new Date() })
    .where(inArray(userTrackedDomains.id, toArchive))
    .returning({ id: userTrackedDomains.id });

  const succeeded = archived.map((d) => d.id);

  return { succeeded, alreadyProcessed, notFound, notOwned };
}

/**
 * Bulk remove (delete) domains for a user with ownership verification.
 * Uses batch operations to avoid N+1 queries.
 *
 * @param userId - The user ID performing the action
 * @param trackedDomainIds - Array of tracked domain IDs to remove
 * @returns Object with arrays of succeeded, notFound, and notOwned IDs
 */
export async function bulkRemoveTrackedDomains(
  userId: string,
  trackedDomainIds: string[],
): Promise<Omit<BulkOperationResult, "alreadyProcessed">> {
  if (trackedDomainIds.length === 0) {
    return { succeeded: [], notFound: [], notOwned: [] };
  }

  // 1. Fetch all requested domains in one query
  const foundDomains = await db
    .select({
      id: userTrackedDomains.id,
      userId: userTrackedDomains.userId,
    })
    .from(userTrackedDomains)
    .where(inArray(userTrackedDomains.id, trackedDomainIds));

  const foundIds = new Set(foundDomains.map((d) => d.id));
  const notFound = trackedDomainIds.filter((id) => !foundIds.has(id));

  // 2. Filter for ownership
  const notOwned: string[] = [];
  const toRemove: string[] = [];

  for (const domain of foundDomains) {
    if (domain.userId !== userId) {
      notOwned.push(domain.id);
    } else {
      toRemove.push(domain.id);
    }
  }

  if (toRemove.length === 0) {
    return { succeeded: [], notFound, notOwned };
  }

  // 3. Batch delete in one query
  const deleted = await db
    .delete(userTrackedDomains)
    .where(inArray(userTrackedDomains.id, toRemove))
    .returning({ id: userTrackedDomains.id });

  const succeeded = deleted.map((d) => d.id);

  return { succeeded, notFound, notOwned };
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

/**
 * Get all stale unverified domains (unverified and older than the cutoff date).
 * Used by the cleanup cron job to identify domains to delete.
 */
export async function getStaleUnverifiedDomains(cutoffDate: Date) {
  const rows = await db
    .select({
      id: userTrackedDomains.id,
      userId: userTrackedDomains.userId,
      domainName: domains.name,
      createdAt: userTrackedDomains.createdAt,
    })
    .from(userTrackedDomains)
    .innerJoin(domains, eq(userTrackedDomains.domainId, domains.id))
    .where(
      and(
        eq(userTrackedDomains.verified, false),
        lt(userTrackedDomains.createdAt, cutoffDate),
      ),
    );

  return rows;
}

/**
 * Delete stale unverified domains.
 * Returns the number of domains deleted.
 */
export async function deleteStaleUnverifiedDomains(
  ids: string[],
): Promise<number> {
  if (ids.length === 0) return 0;

  const deleted = await db
    .delete(userTrackedDomains)
    .where(inArray(userTrackedDomains.id, ids))
    .returning({ id: userTrackedDomains.id });

  return deleted.length;
}

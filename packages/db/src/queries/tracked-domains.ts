import type {
  VerificationMethod,
  VerificationStatus,
} from "@domainstack/constants";
import type {
  DnsRecord,
  ProviderInfo,
  RegistrationContact,
  TrackedDomainWithDetails,
} from "@domainstack/types";
import { deduplicateDnsRecordsByValue } from "@domainstack/utils/dns";
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
  sql,
} from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { db } from "../client";
import {
  certificates,
  dnsRecords,
  domains,
  hosting,
  providers,
  registrations,
  users,
  userTrackedDomains,
} from "../schema";

export interface CreateTrackedDomainParams {
  userId: string;
  domainId: string;
  verificationToken: string;
  verificationMethod?: VerificationMethod;
}

export type CreateTrackedDomainWithLimitCheckResult =
  | { success: true; trackedDomain: typeof userTrackedDomains.$inferSelect }
  | { success: false; reason: "limit_exceeded" | "already_exists" };

export interface TrackedDomainWithDomainName {
  id: string;
  userId: string;
  domainName: string;
  verificationToken: string;
  verificationMethod: VerificationMethod | null;
  verified: boolean;
  verificationStatus: VerificationStatus;
}

// Shared row type for the complex tracked domains query
interface TrackedDomainRow {
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
  muted: boolean;
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
  registrationWhoisServer: string | null;
  registrationRdapServers: string[] | null;
  registrationSource: "rdap" | "whois" | null;
  registrationTransferLock: boolean | null;
  registrationPrivacyEnabled: boolean | null;
  registrationContacts: RegistrationContact[] | null;
}

/**
 * Empty provider info returned for unverified domains.
 */
const EMPTY_PROVIDER_INFO: ProviderInfo = {
  id: null,
  name: null,
  domain: null,
};

/**
 * Empty registrar info for unverified domains.
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
 */
const EMPTY_CA_INFO: ProviderInfo = {
  ...EMPTY_PROVIDER_INFO,
  certificateExpiryDate: null,
};

/**
 * Transform flat query rows into nested TrackedDomainWithDetails structure.
 */
function transformToTrackedDomainWithDetails(
  row: TrackedDomainRow,
): TrackedDomainWithDetails {
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
      muted: row.muted,
      createdAt: row.createdAt,
      verifiedAt: row.verifiedAt,
      archivedAt: row.archivedAt,
      expirationDate: null,
      registrationDate: null,
      registrar: { ...EMPTY_REGISTRAR_INFO },
      dns: { ...EMPTY_PROVIDER_INFO },
      hosting: { ...EMPTY_PROVIDER_INFO },
      email: { ...EMPTY_PROVIDER_INFO },
      ca: { ...EMPTY_CA_INFO },
    };
  }

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
    muted: row.muted,
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
    ca: { ...EMPTY_CA_INFO },
  };
}

export interface TrackedDomainForNotification {
  id: string;
  userId: string;
  domainId: string;
  domainName: string;
  muted: boolean;
  expirationDate: Date | string | null;
  registrar: string | null;
  userEmail: string;
  userName: string;
}

export interface TrackedDomainForReverification {
  id: string;
  userId: string;
  domainName: string;
  verificationToken: string;
  verificationMethod: VerificationMethod;
  verificationStatus: VerificationStatus;
  verificationFailedAt: Date | null;
  muted: boolean;
  userEmail: string;
  userName: string;
}

export interface TrackedDomainCounts {
  active: number;
  archived: number;
}

export interface GetTrackedDomainsOptions {
  includeArchived?: boolean;
  includeDnsRecords?: boolean;
  includeRegistrarDetails?: boolean;
}

export interface BulkOperationResult {
  succeeded: string[];
  alreadyProcessed: string[];
  notFound: string[];
  notOwned: string[];
}

export type UnarchiveTrackedDomainWithLimitCheckResult =
  | { success: true; trackedDomain: typeof userTrackedDomains.$inferSelect }
  | {
      success: false;
      reason: "not_found" | "not_archived" | "limit_exceeded" | "wrong_user";
    };

interface QueryTrackedDomainsOptions {
  includeArchived?: boolean;
  includeDnsRecords?: boolean;
  includeRegistrarDetails?: boolean;
}

/**
 * Fetch DNS records for multiple domains and group them by domain ID and type.
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

  const recordsByDomain = new Map<
    string,
    {
      hosting: DnsRecord[];
      email: DnsRecord[];
      dns: DnsRecord[];
    }
  >();

  for (const record of records) {
    let groups = recordsByDomain.get(record.domainId);
    if (!groups) {
      groups = { hosting: [], email: [], dns: [] };
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

  for (const groups of recordsByDomain.values()) {
    groups.hosting = deduplicateDnsRecordsByValue(groups.hosting).sort((a, b) =>
      a.value.localeCompare(b.value),
    );
    groups.dns = deduplicateDnsRecordsByValue(groups.dns).sort((a, b) =>
      a.value.localeCompare(b.value),
    );
    groups.email = deduplicateDnsRecordsByValue(groups.email).sort((a, b) => {
      const priorityA = a.priority ?? Number.MAX_SAFE_INTEGER;
      const priorityB = b.priority ?? Number.MAX_SAFE_INTEGER;
      if (priorityA !== priorityB) return priorityA - priorityB;
      return a.value.localeCompare(b.value);
    });
  }

  return recordsByDomain;
}

/**
 * Fetch the earliest expiring certificate for each domain.
 */
async function fetchEarliestCertificatesForDomains(
  domainIds: string[],
): Promise<
  Map<
    string,
    {
      caProviderId: string | null;
      caProviderName: string | null;
      caProviderDomain: string | null;
      validTo: Date;
    }
  >
> {
  if (domainIds.length === 0) {
    return new Map();
  }

  const rows = await db
    .selectDistinctOn([certificates.domainId], {
      domainId: certificates.domainId,
      caProviderId: providers.id,
      caProviderName: providers.name,
      caProviderDomain: providers.domain,
      validTo: certificates.validTo,
    })
    .from(certificates)
    .leftJoin(providers, eq(certificates.caProviderId, providers.id))
    .where(inArray(certificates.domainId, domainIds))
    .orderBy(certificates.domainId, asc(certificates.validTo));

  const result = new Map<
    string,
    {
      caProviderId: string | null;
      caProviderName: string | null;
      caProviderDomain: string | null;
      validTo: Date;
    }
  >();

  for (const row of rows) {
    result.set(row.domainId, {
      caProviderId: row.caProviderId,
      caProviderName: row.caProviderName,
      caProviderDomain: row.caProviderDomain,
      validTo: row.validTo,
    });
  }

  return result;
}

/**
 * Attach certificate data to tracked domain results.
 */
function attachCertificates(
  domainsResult: TrackedDomainWithDetails[],
  certificatesByDomain: Map<
    string,
    {
      caProviderId: string | null;
      caProviderName: string | null;
      caProviderDomain: string | null;
      validTo: Date;
    }
  >,
): TrackedDomainWithDetails[] {
  return domainsResult.map((domain) => {
    const cert = certificatesByDomain.get(domain.domainId);
    if (!cert) {
      return domain;
    }

    return {
      ...domain,
      ca: {
        id: cert.caProviderId,
        name: cert.caProviderName,
        domain: cert.caProviderDomain,
        certificateExpiryDate: cert.validTo,
      },
    };
  });
}

/**
 * Internal helper to query tracked domains with full details.
 */
async function queryTrackedDomainsWithDetails(
  whereCondition: SQL,
  orderByColumn:
    | typeof userTrackedDomains.createdAt
    | typeof userTrackedDomains.archivedAt,
  options: QueryTrackedDomainsOptions = {},
): Promise<TrackedDomainWithDetails[]> {
  const { includeDnsRecords = true, includeRegistrarDetails = true } = options;

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
      tld: domains.tld,
      verified: userTrackedDomains.verified,
      verificationMethod: userTrackedDomains.verificationMethod,
      verificationToken: userTrackedDomains.verificationToken,
      verificationStatus: userTrackedDomains.verificationStatus,
      verificationFailedAt: userTrackedDomains.verificationFailedAt,
      lastVerifiedAt: userTrackedDomains.lastVerifiedAt,
      muted: userTrackedDomains.muted,
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
    .where(whereCondition)
    .orderBy(orderByColumn);

  let domainsResult = rows.map(transformToTrackedDomainWithDetails);

  if (domainsResult.length === 0) {
    return domainsResult;
  }

  const domainIds = domainsResult.map((d) => d.domainId);
  const [certificatesByDomain, dnsRecordsByDomain] = await Promise.all([
    fetchEarliestCertificatesForDomains(domainIds),
    includeDnsRecords ? fetchDnsRecordsForDomains(domainIds) : null,
  ]);

  domainsResult = attachCertificates(domainsResult, certificatesByDomain);

  if (dnsRecordsByDomain) {
    domainsResult = domainsResult.map((domain) => {
      const records = dnsRecordsByDomain.get(domain.domainId);
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

  if (!includeRegistrarDetails) {
    domainsResult = domainsResult.map((domain) => ({
      ...domain,
      registrar: {
        id: domain.registrar.id,
        name: domain.registrar.name,
        domain: domain.registrar.domain,
      },
    }));
  }

  return domainsResult;
}

/**
 * Create a new tracked domain record.
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

/**
 * Create a new tracked domain record with atomic limit checking.
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
    const lockedRows = await tx
      .select({ id: userTrackedDomains.id })
      .from(userTrackedDomains)
      .where(
        and(
          eq(userTrackedDomains.userId, userId),
          isNull(userTrackedDomains.archivedAt),
        ),
      )
      .for("update");

    const currentCount = lockedRows.length;

    if (currentCount >= maxDomains) {
      return { success: false, reason: "limit_exceeded" } as const;
    }

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

/**
 * Find a tracked domain by ID with its domain name.
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

/**
 * Get all tracked domains for a user with domain details.
 */
export async function getTrackedDomainsForUser(
  userId: string,
  options: GetTrackedDomainsOptions | boolean = {},
): Promise<TrackedDomainWithDetails[]> {
  const opts =
    typeof options === "boolean" ? { includeArchived: options } : options;
  const {
    includeArchived = false,
    includeDnsRecords = true,
    includeRegistrarDetails = true,
  } = opts;

  const whereCondition = includeArchived
    ? eq(userTrackedDomains.userId, userId)
    : and(
        eq(userTrackedDomains.userId, userId),
        isNull(userTrackedDomains.archivedAt),
      );

  return queryTrackedDomainsWithDetails(
    whereCondition as SQL,
    userTrackedDomains.createdAt,
    { includeDnsRecords, includeRegistrarDetails },
  );
}

/**
 * Get a single tracked domain with full details including DNS records.
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
 */
export async function countTrackedDomainsForUser(
  userId: string,
  includeArchived = false,
): Promise<number> {
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
 * Count active and archived tracked domains for a user.
 */
export async function countTrackedDomainsByStatus(
  userId: string,
): Promise<TrackedDomainCounts> {
  const [result] = await db
    .select({
      active: count(
        sql`CASE WHEN ${userTrackedDomains.archivedAt} IS NULL THEN 1 END`,
      ),
      archived: count(
        sql`CASE WHEN ${userTrackedDomains.archivedAt} IS NOT NULL THEN 1 END`,
      ),
    })
    .from(userTrackedDomains)
    .where(eq(userTrackedDomains.userId, userId));

  return {
    active: result?.active ?? 0,
    archived: result?.archived ?? 0,
  };
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
 * Set the muted state for a tracked domain.
 */
export async function setDomainMuted(id: string, muted: boolean) {
  const updated = await db
    .update(userTrackedDomains)
    .set({ muted })
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
export async function deleteTrackedDomain(id: string): Promise<boolean> {
  await db.delete(userTrackedDomains).where(eq(userTrackedDomains.id, id));
  return true;
}

/**
 * Get verified tracked domain IDs.
 */
export async function getVerifiedTrackedDomainIds(): Promise<string[]> {
  const rows = await db
    .select({ id: userTrackedDomains.id })
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
 * Get a single tracked domain for notification.
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
      muted: userTrackedDomains.muted,
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
      muted: userTrackedDomains.muted,
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
 */
export async function markVerificationFailing(id: string) {
  const updated = await db
    .update(userTrackedDomains)
    .set({
      verificationStatus: "failing",
      verificationFailedAt: sql`COALESCE(${userTrackedDomains.verificationFailedAt}, NOW())`,
    })
    .where(eq(userTrackedDomains.id, id))
    .returning();

  return updated[0] ?? null;
}

/**
 * Revoke a domain's verification.
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

/**
 * Archive a tracked domain.
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

/**
 * Unarchive a tracked domain with atomic limit checking.
 */
export async function unarchiveTrackedDomainWithLimitCheck(
  id: string,
  userId: string,
  maxDomains: number,
): Promise<UnarchiveTrackedDomainWithLimitCheckResult> {
  return await db.transaction(async (tx) => {
    const [tracked] = await tx
      .select()
      .from(userTrackedDomains)
      .where(eq(userTrackedDomains.id, id))
      .limit(1);

    if (!tracked) {
      return { success: false, reason: "not_found" } as const;
    }

    if (tracked.userId !== userId) {
      return { success: false, reason: "wrong_user" } as const;
    }

    if (!tracked.archivedAt) {
      return { success: false, reason: "not_archived" } as const;
    }

    const lockedRows = await tx
      .select({ id: userTrackedDomains.id })
      .from(userTrackedDomains)
      .where(
        and(
          eq(userTrackedDomains.userId, userId),
          isNull(userTrackedDomains.archivedAt),
        ),
      )
      .for("update");

    const currentCount = lockedRows.length;

    if (currentCount >= maxDomains) {
      return { success: false, reason: "limit_exceeded" } as const;
    }

    const [updated] = await tx
      .update(userTrackedDomains)
      .set({ archivedAt: null })
      .where(eq(userTrackedDomains.id, id))
      .returning();

    return { success: true, trackedDomain: updated } as const;
  });
}

/**
 * Archive the oldest active tracked domains for a user.
 */
export async function archiveOldestActiveDomains(
  userId: string,
  countToArchive: number,
): Promise<number> {
  if (countToArchive <= 0) return 0;

  const result = await db
    .update(userTrackedDomains)
    .set({ archivedAt: new Date() })
    .where(
      inArray(
        userTrackedDomains.id,
        db
          .select({ id: userTrackedDomains.id })
          .from(userTrackedDomains)
          .where(
            and(
              eq(userTrackedDomains.userId, userId),
              isNull(userTrackedDomains.archivedAt),
            ),
          )
          .orderBy(asc(userTrackedDomains.createdAt))
          .limit(countToArchive),
      ),
    )
    .returning({ id: userTrackedDomains.id });

  return result.length;
}

/**
 * Bulk archive domains for a user with ownership verification.
 */
export async function bulkArchiveTrackedDomains(
  userId: string,
  trackedDomainIds: string[],
): Promise<BulkOperationResult> {
  if (trackedDomainIds.length === 0) {
    return {
      succeeded: [],
      alreadyProcessed: [],
      notFound: [],
      notOwned: [],
    };
  }

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
 */
export async function bulkRemoveTrackedDomains(
  userId: string,
  trackedDomainIds: string[],
): Promise<Omit<BulkOperationResult, "alreadyProcessed">> {
  if (trackedDomainIds.length === 0) {
    return { succeeded: [], notFound: [], notOwned: [] };
  }

  const foundDomains = await db
    .select({
      id: userTrackedDomains.id,
      userId: userTrackedDomains.userId,
    })
    .from(userTrackedDomains)
    .where(inArray(userTrackedDomains.id, trackedDomainIds));

  const foundIds = new Set(foundDomains.map((d) => d.id));
  const notFound = trackedDomainIds.filter((id) => !foundIds.has(id));

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

  return queryTrackedDomainsWithDetails(
    whereCondition as SQL,
    userTrackedDomains.archivedAt,
  );
}

/**
 * Get all stale unverified domains (unverified and older than the cutoff date).
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

import type { SQL } from "drizzle-orm";
import { and, asc, count, eq, inArray, isNull, or, sql } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";

import { MAX_TRACKED_DOMAIN_ROWS, PLAN_QUOTAS } from "@domainstack/constants";
import type {
  DnsRecord,
  ProviderInfo,
  RegistrationContact,
  RegistrationSource,
  TrackedDomainWithDetails,
  VerificationMethod,
  VerificationStatus,
} from "@domainstack/types";
import { deduplicateDnsRecordsByValue } from "@domainstack/utils/dns";

import { db } from "../client";
import {
  certificates,
  dnsRecords,
  domains,
  domainSnapshots,
  hosting,
  providers,
  registrations,
  userSubscriptions,
  users,
  userTrackedDomains,
} from "../schema";
import { getFreshFaviconUrls } from "./favicons";
import { getFreshProviderLogoUrls } from "./provider-logos";

/**
 * Active eligibility for cron-driven workflows: verified and not archived.
 * Cron selectors enqueue on it, and every workflow re-checks it at its entry
 * read and before delivering a notification, because a queued or retried run
 * can outlive the selection. `verified` is the authority flag, not
 * `verificationStatus`.
 */
export const activeTrackedDomain = and(
  eq(userTrackedDomains.verified, true),
  isNull(userTrackedDomains.archivedAt),
) as SQL;

export interface CreateTrackedDomainParams {
  userId: string;
  domainId: string;
  verificationToken: string;
  verificationMethod?: VerificationMethod;
}

export type CreateTrackedDomainWithLimitCheckResult =
  | { success: true; trackedDomain: typeof userTrackedDomains.$inferSelect }
  | { success: false; reason: "limit_exceeded" | "total_limit_exceeded" | "already_exists" };

export interface TrackedDomainWithDomainName {
  id: string;
  userId: string;
  domainName: string;
  verificationToken: string;
  verificationMethod: VerificationMethod | null;
  verified: boolean;
  verificationStatus: VerificationStatus;
  archivedAt: Date | null;
  createdAt: Date;
  verifiedAt: Date | null;
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
  registrationSource: RegistrationSource | null;
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
function transformToTrackedDomainWithDetails(row: TrackedDomainRow): TrackedDomainWithDetails {
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
  /** Registration cache observation time; expiry checks refresh it when `registrationExpiresAt` has elapsed. */
  registrationFetchedAt: Date;
  /** Registration cache policy window (not the domain's expiration). */
  registrationExpiresAt: Date;
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
  includeIconUrls?: boolean;
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
  includeIconUrls?: boolean;
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
async function fetchEarliestCertificatesForDomains(domainIds: string[]): Promise<
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
    .where(
      and(
        inArray(certificates.domainId, domainIds),
        or(eq(certificates.chainPosition, 0), isNull(certificates.chainPosition)),
      ),
    )
    .orderBy(certificates.domainId, asc(certificates.chainPosition), asc(certificates.validTo));

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
  orderByColumn: typeof userTrackedDomains.createdAt | typeof userTrackedDomains.archivedAt,
  options: QueryTrackedDomainsOptions = {},
): Promise<TrackedDomainWithDetails[]> {
  const {
    includeDnsRecords = true,
    includeRegistrarDetails = true,
    includeIconUrls = false,
  } = options;

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
      // Skip reading registrar details (notably the contacts jsonb) when they are discarded below.
      registrationWhoisServer: includeRegistrarDetails
        ? registrations.whoisServer
        : sql<string | null>`null`,
      registrationRdapServers: includeRegistrarDetails
        ? registrations.rdapServers
        : sql<string[] | null>`null`,
      registrationSource: includeRegistrarDetails
        ? registrations.source
        : sql<RegistrationSource | null>`null`,
      registrationTransferLock: includeRegistrarDetails
        ? registrations.transferLock
        : sql<boolean | null>`null`,
      registrationPrivacyEnabled: includeRegistrarDetails
        ? registrations.privacyEnabled
        : sql<boolean | null>`null`,
      registrationContacts: includeRegistrarDetails
        ? registrations.contacts
        : sql<RegistrationContact[] | null>`null`,
    })
    .from(userTrackedDomains)
    .innerJoin(domains, eq(userTrackedDomains.domainId, domains.id))
    .leftJoin(registrations, eq(domains.id, registrations.domainId))
    .leftJoin(registrarProvider, eq(registrations.registrarProviderId, registrarProvider.id))
    .leftJoin(hosting, eq(domains.id, hosting.domainId))
    .leftJoin(dnsProvider, eq(hosting.dnsProviderId, dnsProvider.id))
    .leftJoin(hostingProvider, eq(hosting.hostingProviderId, hostingProvider.id))
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

  if (includeIconUrls) {
    const providerIds = new Set<string>();
    for (const domain of domainsResult) {
      for (const provider of [
        domain.registrar,
        domain.dns,
        domain.hosting,
        domain.email,
        domain.ca,
      ]) {
        if (provider.id) providerIds.add(provider.id);
      }
    }

    const [faviconUrls, providerLogoUrls] = await Promise.all([
      getFreshFaviconUrls(domainIds),
      getFreshProviderLogoUrls([...providerIds]),
    ]);

    // Tri-state: string = known url, null = known none, undefined = unknown (not in cache).
    const withLogo = (provider: ProviderInfo): ProviderInfo =>
      provider.id
        ? {
            ...provider,
            logoUrl: providerLogoUrls.has(provider.id)
              ? providerLogoUrls.get(provider.id)
              : undefined,
          }
        : provider;

    domainsResult = domainsResult.map((domain) => ({
      ...domain,
      faviconUrl: faviconUrls.has(domain.domainId) ? faviconUrls.get(domain.domainId) : undefined,
      registrar: withLogo(domain.registrar),
      dns: withLogo(domain.dns),
      hosting: withLogo(domain.hosting),
      email: withLogo(domain.email),
      ca: withLogo(domain.ca),
    }));
  }

  return domainsResult;
}

/**
 * Serialize plan-limit checks for one user for the rest of the transaction.
 *
 * `SELECT … FOR UPDATE` alone is not enough: it locks existing rows only, so two
 * concurrent transactions can both count N < max and both insert. A
 * transaction-scoped advisory lock keyed on the user makes the count-then-write
 * sequence exclusive per user. Released automatically at commit/rollback.
 */
export async function lockUserDomainQuota(
  tx: Parameters<Parameters<typeof db.transaction>[0]>[0],
  userId: string,
) {
  await tx.execute(
    sql`select pg_advisory_xact_lock(hashtext(${"tracked-domain-quota:" + userId}))`,
  );
}

/** The user's plan quota, read inside the quota-locked transaction so a concurrent downgrade can't be missed. */
async function readPlanQuota(
  tx: Parameters<Parameters<typeof db.transaction>[0]>[0],
  userId: string,
) {
  const [row] = await tx
    .select({ tier: userSubscriptions.tier })
    .from(userSubscriptions)
    .where(eq(userSubscriptions.userId, userId))
    .limit(1);
  return PLAN_QUOTAS[row?.tier ?? "free"];
}

/**
 * Create a new tracked domain record with limit checking serialized per user via an advisory lock.
 * The plan quota is read under that lock, so a concurrent downgrade can't be missed.
 */
export async function createTrackedDomainWithLimitCheck(
  params: CreateTrackedDomainParams,
): Promise<CreateTrackedDomainWithLimitCheckResult> {
  const { userId, domainId, verificationToken, verificationMethod } = params;

  return await db.transaction(async (tx) => {
    await lockUserDomainQuota(tx, userId);
    const maxDomains = await readPlanQuota(tx, userId);

    // Archiving frees quota, so cap total rows (archived included) too.
    const [totals] = await tx
      .select({ total: count() })
      .from(userTrackedDomains)
      .where(eq(userTrackedDomains.userId, userId));

    if ((totals?.total ?? 0) >= MAX_TRACKED_DOMAIN_ROWS) {
      return { success: false, reason: "total_limit_exceeded" } as const;
    }

    const lockedRows = await tx
      .select({ id: userTrackedDomains.id })
      .from(userTrackedDomains)
      .where(and(eq(userTrackedDomains.userId, userId), isNull(userTrackedDomains.archivedAt)))
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
    .where(and(eq(userTrackedDomains.userId, userId), eq(userTrackedDomains.domainId, domainId)))
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
      archivedAt: userTrackedDomains.archivedAt,
      createdAt: userTrackedDomains.createdAt,
      verifiedAt: userTrackedDomains.verifiedAt,
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
  {
    includeArchived = false,
    includeDnsRecords = true,
    includeRegistrarDetails = true,
    includeIconUrls = false,
  }: GetTrackedDomainsOptions = {},
): Promise<TrackedDomainWithDetails[]> {
  const whereCondition = includeArchived
    ? eq(userTrackedDomains.userId, userId)
    : and(eq(userTrackedDomains.userId, userId), isNull(userTrackedDomains.archivedAt));

  return queryTrackedDomainsWithDetails(whereCondition as SQL, userTrackedDomains.createdAt, {
    includeDnsRecords,
    includeRegistrarDetails,
    includeIconUrls,
  });
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
 * Count active and archived tracked domains for a user.
 */
export async function countTrackedDomainsByStatus(userId: string): Promise<TrackedDomainCounts> {
  const [result] = await db
    .select({
      active: count(sql`CASE WHEN ${userTrackedDomains.archivedAt} IS NULL THEN 1 END`),
      archived: count(sql`CASE WHEN ${userTrackedDomains.archivedAt} IS NOT NULL THEN 1 END`),
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
 *
 * Two independent callers can race for the same domain: the auto-verify
 * workflow's own DNS/HTML/meta check, and the manual `verifyDomain`
 * mutation (which also kicks off a snapshot-baseline workflow). A
 * FOR-UPDATE row lock plus an already-verified no-op guard keeps a losing
 * second call from wiping a snapshot the winner just established.
 */
export async function verifyTrackedDomain(id: string, method: VerificationMethod) {
  const now = new Date();
  return await db.transaction(async (tx) => {
    const [current] = await tx
      .select({ verified: userTrackedDomains.verified })
      .from(userTrackedDomains)
      .where(eq(userTrackedDomains.id, id))
      .for("update");

    if (!current) return null;

    if (current.verified) {
      // Already verified by a concurrent call — don't wipe its snapshot.
      const [existing] = await tx
        .select()
        .from(userTrackedDomains)
        .where(eq(userTrackedDomains.id, id));
      return existing ?? null;
    }

    // A domain becoming verified (again) may carry a snapshot from a previous
    // verified period; drop it so monitoring starts from a fresh baseline.
    await tx.delete(domainSnapshots).where(eq(domainSnapshots.trackedDomainId, id));

    const updated = await tx
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
  });
}

/**
 * Mute or unmute a tracked domain.
 */
export async function muteTrackedDomain(id: string, userId: string, muted: boolean) {
  const updated = await db
    .update(userTrackedDomains)
    .set({ muted })
    .where(and(eq(userTrackedDomains.id, id), eq(userTrackedDomains.userId, userId)))
    .returning();

  if (updated.length === 0) {
    return null;
  }

  return updated[0];
}

/**
 * Remove (delete) a tracked domain.
 */
export async function removeTrackedDomain(id: string, userId: string): Promise<boolean> {
  const deleted = await db
    .delete(userTrackedDomains)
    .where(and(eq(userTrackedDomains.id, id), eq(userTrackedDomains.userId, userId)))
    .returning({ id: userTrackedDomains.id });

  return deleted.length > 0;
}

/**
 * Get verified tracked domain IDs.
 */
export async function getVerifiedTrackedDomainIds(): Promise<string[]> {
  const rows = await db
    .select({ id: userTrackedDomains.id })
    .from(userTrackedDomains)
    .where(activeTrackedDomain);

  return rows.map((r) => r.id);
}

/**
 * Whether a tracked domain is still verified and not archived. The final
 * just-in-time check before a notification is delivered; muting and category
 * preferences are separate concerns.
 */
export async function isTrackedDomainNotificationEligible(id: string): Promise<boolean> {
  const rows = await db
    .select({ id: userTrackedDomains.id })
    .from(userTrackedDomains)
    .where(and(eq(userTrackedDomains.id, id), activeTrackedDomain))
    .limit(1);

  return rows.length > 0;
}

/**
 * Get a single tracked domain for notification. Null unless it is still
 * verified and not archived.
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
      registrationFetchedAt: registrations.fetchedAt,
      registrationExpiresAt: registrations.expiresAt,
      userEmail: users.email,
      userName: users.name,
    })
    .from(userTrackedDomains)
    .innerJoin(domains, eq(userTrackedDomains.domainId, domains.id))
    .innerJoin(registrations, eq(domains.id, registrations.domainId))
    .innerJoin(users, eq(userTrackedDomains.userId, users.id))
    .leftJoin(registrarProvider, eq(registrations.registrarProviderId, registrarProvider.id))
    .where(and(eq(userTrackedDomains.id, trackedDomainId), activeTrackedDomain))
    .limit(1);

  return rows[0] ?? null;
}

/**
 * Get a single tracked domain for reverification. Null unless it is still
 * verified and not archived.
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
    .where(and(eq(userTrackedDomains.id, trackedDomainId), activeTrackedDomain))
    .limit(1);

  if (rows.length === 0 || !rows[0].verificationMethod) {
    return null;
  }

  return rows[0] as TrackedDomainForReverification;
}

/**
 * Record a passing re-verification. Only touches a domain that is still
 * verified: a concurrent revoke must not leave `verified = false` with a
 * `"verified"` status.
 *
 * Pass `method` when the passing check may have used a different method than
 * the stored one (a user fixing a failing domain), so re-verification checks
 * the method that now works.
 */
export async function markVerificationSuccessful(id: string, method?: VerificationMethod) {
  const updated = await db
    .update(userTrackedDomains)
    .set({
      verificationStatus: "verified",
      verificationFailedAt: null,
      lastVerifiedAt: new Date(),
      ...(method ? { verificationMethod: method } : {}),
    })
    .where(and(eq(userTrackedDomains.id, id), eq(userTrackedDomains.verified, true)))
    .returning();

  return updated[0] ?? null;
}

/** The verification state a re-verification run read, for compare-and-set writes. */
interface ExpectedVerificationState {
  status: VerificationStatus;
  failedAt: Date | null;
}

/** Matches rows whose failure timestamp equals `failedAt` (at the millisecond precision JS keeps). */
function verificationFailedAtIs(failedAt: Date | null): SQL {
  return failedAt === null
    ? isNull(userTrackedDomains.verificationFailedAt)
    : sql`date_trunc('milliseconds', ${userTrackedDomains.verificationFailedAt}) = ${failedAt}`;
}

/**
 * Mark a domain's verification as failing, keeping an existing failure
 * timestamp. Compare-and-set: writes only if the row is still in `expected`,
 * and returns null when a concurrent run changed it first.
 */
export async function markVerificationFailing(
  id: string,
  expected: ExpectedVerificationState,
): Promise<typeof userTrackedDomains.$inferSelect | null> {
  const updated = await db
    .update(userTrackedDomains)
    .set({
      verificationStatus: "failing",
      verificationFailedAt: sql`COALESCE(${userTrackedDomains.verificationFailedAt}, NOW())`,
    })
    .where(
      and(
        eq(userTrackedDomains.id, id),
        eq(userTrackedDomains.verificationStatus, expected.status),
        verificationFailedAtIs(expected.failedAt),
      ),
    )
    .returning();

  return updated[0] ?? null;
}

/**
 * Revoke a domain's verification at the end of the failure episode that began
 * at `failedAt`. Returns null without writing if the domain recovered or a new
 * episode started in the meantime.
 */
export async function revokeVerification(id: string, failedAt: Date) {
  const updated = await db
    .update(userTrackedDomains)
    .set({
      verified: false,
      verificationStatus: "unverified",
      verificationFailedAt: null,
    })
    .where(
      and(
        eq(userTrackedDomains.id, id),
        eq(userTrackedDomains.verificationStatus, "failing"),
        verificationFailedAtIs(failedAt),
      ),
    )
    .returning();

  return updated[0] ?? null;
}

export type ArchiveTrackedDomainResult =
  | { success: true; archivedAt: Date }
  | { success: false; reason: "not_found" | "already_archived" };

/**
 * Archive a user's tracked domain in one conditional update. "not_found" also
 * covers another user's domain, so callers can't tell the two apart.
 */
export async function archiveTrackedDomain(
  id: string,
  userId: string,
): Promise<ArchiveTrackedDomainResult> {
  const owned = and(eq(userTrackedDomains.id, id), eq(userTrackedDomains.userId, userId));

  const [archived] = await db
    .update(userTrackedDomains)
    .set({ archivedAt: new Date() })
    .where(and(owned, isNull(userTrackedDomains.archivedAt)))
    .returning({ archivedAt: userTrackedDomains.archivedAt });

  if (archived?.archivedAt) {
    return { success: true, archivedAt: archived.archivedAt };
  }

  const [existing] = await db
    .select({ id: userTrackedDomains.id })
    .from(userTrackedDomains)
    .where(owned);

  return { success: false, reason: existing ? "already_archived" : "not_found" };
}

/**
 * Unarchive a tracked domain with limit checking serialized per user via an advisory lock.
 * The plan quota is read under that lock, so a concurrent downgrade can't be missed.
 */
export async function unarchiveTrackedDomainWithLimitCheck(
  id: string,
  userId: string,
): Promise<UnarchiveTrackedDomainWithLimitCheckResult> {
  return await db.transaction(async (tx) => {
    await lockUserDomainQuota(tx, userId);
    const maxDomains = await readPlanQuota(tx, userId);

    const [tracked] = await tx
      .select()
      .from(userTrackedDomains)
      .where(eq(userTrackedDomains.id, id))
      .for("update");

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
      .where(and(eq(userTrackedDomains.userId, userId), isNull(userTrackedDomains.archivedAt)))
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

    // The snapshot predates the archive; comparing against it would report every
    // change made while unmonitored as new. Drop it so the monitor cron writes a
    // fresh baseline.
    await tx.delete(domainSnapshots).where(eq(domainSnapshots.trackedDomainId, id));

    return { success: true, trackedDomain: updated } as const;
  });
}

/**
 * Run one conditional write over the user's rows among `trackedDomainIds`, then
 * sort the ids it didn't touch into missing, someone else's, and already in the
 * target state.
 *
 * The write itself carries the ownership and state predicates (`write` adds the
 * state one to `owned`), so a row that changes between the write and the
 * classification can't be updated from a stale read — the same shape as the
 * single-domain mutations. Two queries regardless of how many ids.
 */
async function bulkWriteOwned(
  userId: string,
  trackedDomainIds: string[],
  write: (owned: SQL) => Promise<{ id: string }[]>,
): Promise<BulkOperationResult> {
  if (trackedDomainIds.length === 0) {
    return { succeeded: [], alreadyProcessed: [], notFound: [], notOwned: [] };
  }

  const owned = and(
    inArray(userTrackedDomains.id, trackedDomainIds),
    eq(userTrackedDomains.userId, userId),
  ) as SQL;
  const succeeded = (await write(owned)).map((row) => row.id);

  const written = new Set(succeeded);
  const untouched = trackedDomainIds.filter((id) => !written.has(id));
  const result: BulkOperationResult = {
    succeeded,
    alreadyProcessed: [],
    notFound: [],
    notOwned: [],
  };
  if (untouched.length === 0) return result;

  const rows = await db
    .select({ id: userTrackedDomains.id, userId: userTrackedDomains.userId })
    .from(userTrackedDomains)
    .where(inArray(userTrackedDomains.id, untouched));
  const ownerById = new Map(rows.map((row) => [row.id, row.userId]));

  for (const id of untouched) {
    const owner = ownerById.get(id);
    if (owner === undefined) result.notFound.push(id);
    else if (owner !== userId) result.notOwned.push(id);
    // Owned but not written: the state predicate excluded it.
    else result.alreadyProcessed.push(id);
  }

  return result;
}

/**
 * Bulk archive domains for a user with ownership verification.
 */
export async function bulkArchiveTrackedDomains(
  userId: string,
  trackedDomainIds: string[],
): Promise<BulkOperationResult> {
  return bulkWriteOwned(userId, trackedDomainIds, (owned) =>
    db
      .update(userTrackedDomains)
      .set({ archivedAt: new Date() })
      .where(and(owned, isNull(userTrackedDomains.archivedAt)))
      .returning({ id: userTrackedDomains.id }),
  );
}

/**
 * Bulk set muted on domains for a user with ownership verification.
 */
export async function bulkMuteTrackedDomains(
  userId: string,
  trackedDomainIds: string[],
  muted: boolean,
): Promise<BulkOperationResult> {
  return bulkWriteOwned(userId, trackedDomainIds, (owned) =>
    db
      .update(userTrackedDomains)
      .set({ muted })
      .where(and(owned, eq(userTrackedDomains.muted, !muted)))
      .returning({ id: userTrackedDomains.id }),
  );
}

/**
 * Bulk remove (delete) domains for a user with ownership verification.
 */
export async function bulkRemoveTrackedDomains(
  userId: string,
  trackedDomainIds: string[],
): Promise<Omit<BulkOperationResult, "alreadyProcessed">> {
  // Every owned row is deleted, so nothing is ever "already processed"; a row
  // deleted concurrently is simply gone and reports as not found.
  const { alreadyProcessed: _alreadyProcessed, ...result } = await bulkWriteOwned(
    userId,
    trackedDomainIds,
    (owned) => db.delete(userTrackedDomains).where(owned).returning({ id: userTrackedDomains.id }),
  );
  return result;
}

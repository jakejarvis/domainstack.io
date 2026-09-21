import { and, eq, isNull } from "drizzle-orm";

import type {
  CertificateSnapshotData,
  DnssecSnapshotData,
  PendingChangeObservation,
  RegistrationSnapshotData,
} from "@domainstack/types";

import { db } from "../client";
import { domainSnapshots, domains, users, userTrackedDomains } from "../schema";

/**
 * Parameters for creating a new snapshot.
 */
export interface CreateSnapshotParams {
  trackedDomainId: string;
  registration?: RegistrationSnapshotData;
  certificate?: CertificateSnapshotData;
  dnsProviderId?: string | null;
  hostingProviderId?: string | null;
  emailProviderId?: string | null;
  /** Omit or pass `null` when DNSSEC was not observed; monitoring adopts it silently later. */
  dnssec?: DnssecSnapshotData | null;
}

/**
 * Parameters for updating an existing snapshot.
 */
export interface UpdateSnapshotParams {
  registration?: RegistrationSnapshotData;
  certificate?: CertificateSnapshotData;
  dnsProviderId?: string | null;
  hostingProviderId?: string | null;
  emailProviderId?: string | null;
  providerPending?: PendingChangeObservation | null;
  dnssec?: DnssecSnapshotData | null;
}

/**
 * Snapshot data with user and domain metadata for monitoring.
 */
export interface SnapshotForMonitoring {
  id: string;
  trackedDomainId: string;
  userId: string;
  domainId: string;
  domainName: string;
  registration: RegistrationSnapshotData;
  certificate: CertificateSnapshotData;
  dnsProviderId: string | null;
  hostingProviderId: string | null;
  emailProviderId: string | null;
  providerPending: PendingChangeObservation | null;
  /** `null` until the first monitoring run (or baseline) observes DNSSEC. */
  dnssec: DnssecSnapshotData | null;
  userEmail: string;
  userName: string;
}

// Default empty snapshot data shapes
const EMPTY_REGISTRATION: RegistrationSnapshotData = {
  registrarProviderId: null,
  nameservers: [],
  transferLock: null,
  statuses: [],
};

const EMPTY_CERTIFICATE: CertificateSnapshotData = {
  caProviderId: null,
  issuer: "",
  validTo: "",
  fingerprint: null,
  serialNumber: null,
};

/**
 * Create the baseline snapshot for a tracked domain.
 *
 * Insert-only: returns `null` when a snapshot already exists. A baseline must
 * never replace a snapshot that change detection may already have advanced —
 * that would roll it back and re-alert changes the user was already told about.
 */
export async function createSnapshot(
  params: CreateSnapshotParams,
): Promise<typeof domainSnapshots.$inferSelect | null> {
  const {
    trackedDomainId,
    registration = EMPTY_REGISTRATION,
    certificate = EMPTY_CERTIFICATE,
    dnsProviderId = null,
    hostingProviderId = null,
    emailProviderId = null,
    dnssec = null,
  } = params;

  const inserted = await db
    .insert(domainSnapshots)
    .values({
      trackedDomainId,
      registration,
      certificate,
      dnsProviderId,
      hostingProviderId,
      emailProviderId,
      dnssec,
    })
    .onConflictDoNothing({ target: domainSnapshots.trackedDomainId })
    .returning();

  return inserted[0] ?? null;
}

/**
 * Update an existing snapshot with new data.
 */
export async function updateSnapshot(trackedDomainId: string, params: UpdateSnapshotParams) {
  const updates: Partial<typeof domainSnapshots.$inferInsert> = {
    updatedAt: new Date(),
  };

  if (params.registration !== undefined) {
    updates.registration = params.registration;
  }
  if (params.certificate !== undefined) {
    updates.certificate = params.certificate;
  }
  if (params.dnsProviderId !== undefined) {
    updates.dnsProviderId = params.dnsProviderId;
  }
  if (params.hostingProviderId !== undefined) {
    updates.hostingProviderId = params.hostingProviderId;
  }
  if (params.emailProviderId !== undefined) {
    updates.emailProviderId = params.emailProviderId;
  }
  if (params.providerPending !== undefined) {
    updates.providerPending = params.providerPending;
  }
  if (params.dnssec !== undefined) {
    updates.dnssec = params.dnssec;
  }

  const updated = await db
    .update(domainSnapshots)
    .set(updates)
    .where(eq(domainSnapshots.trackedDomainId, trackedDomainId))
    .returning();

  if (updated.length === 0) {
    return null;
  }

  return updated[0];
}

/**
 * Get all snapshot IDs for verified, non-archived tracked domains.
 */
export async function getMonitoredSnapshotIds(): Promise<string[]> {
  const rows = await db
    .select({ trackedDomainId: domainSnapshots.trackedDomainId })
    .from(domainSnapshots)
    .innerJoin(userTrackedDomains, eq(domainSnapshots.trackedDomainId, userTrackedDomains.id))
    .where(and(eq(userTrackedDomains.verified, true), isNull(userTrackedDomains.archivedAt)));

  return rows.map((r) => r.trackedDomainId);
}

/**
 * Get verified, non-archived tracked domains that don't have snapshots yet.
 */
export async function getVerifiedDomainsWithoutSnapshots(): Promise<
  Array<{ trackedDomainId: string; domainId: string }>
> {
  const rows = await db
    .select({
      trackedDomainId: userTrackedDomains.id,
      domainId: userTrackedDomains.domainId,
    })
    .from(userTrackedDomains)
    .leftJoin(domainSnapshots, eq(userTrackedDomains.id, domainSnapshots.trackedDomainId))
    .where(
      and(
        eq(userTrackedDomains.verified, true),
        isNull(userTrackedDomains.archivedAt),
        isNull(domainSnapshots.id),
      ),
    );

  return rows;
}

/**
 * Get full snapshot data for a single domain.
 */
export async function getSnapshot(trackedDomainId: string): Promise<SnapshotForMonitoring | null> {
  const rows = await db
    .select({
      id: domainSnapshots.id,
      trackedDomainId: domainSnapshots.trackedDomainId,
      userId: userTrackedDomains.userId,
      domainId: userTrackedDomains.domainId,
      domainName: domains.name,
      registration: domainSnapshots.registration,
      certificate: domainSnapshots.certificate,
      dnsProviderId: domainSnapshots.dnsProviderId,
      hostingProviderId: domainSnapshots.hostingProviderId,
      emailProviderId: domainSnapshots.emailProviderId,
      providerPending: domainSnapshots.providerPending,
      dnssec: domainSnapshots.dnssec,
      userEmail: users.email,
      userName: users.name,
    })
    .from(domainSnapshots)
    .innerJoin(userTrackedDomains, eq(domainSnapshots.trackedDomainId, userTrackedDomains.id))
    .innerJoin(domains, eq(userTrackedDomains.domainId, domains.id))
    .innerJoin(users, eq(userTrackedDomains.userId, users.id))
    .where(eq(domainSnapshots.trackedDomainId, trackedDomainId))
    .limit(1);

  if (rows.length === 0) {
    return null;
  }

  return rows[0];
}

import "server-only";

import { and, eq, isNotNull, isNull } from "drizzle-orm";
import { db } from "@/lib/db/client";
import {
  domainSnapshots,
  domains,
  users,
  userTrackedDomains,
} from "@/lib/db/schema";
import { createLogger } from "@/lib/logger/server";

const logger = createLogger({ source: "snapshots" });

// Types for snapshot data
export type RegistrationSnapshotData = {
  registrarProviderId: string | null;
  nameservers: Array<{ host: string }>;
  transferLock: boolean | null;
  statuses: string[];
};

export type CertificateSnapshotData = {
  caProviderId: string | null;
  issuer: string;
  validTo: string; // ISO date string
  fingerprint: string | null;
};

export type ProviderSnapshotData = {
  dnsProviderId: string | null;
  hostingProviderId: string | null;
  emailProviderId: string | null;
};

export type SnapshotData = {
  registration: RegistrationSnapshotData;
  certificate: CertificateSnapshotData;
  providers: ProviderSnapshotData;
};

export type CreateSnapshotParams = {
  trackedDomainId: string;
  registration: RegistrationSnapshotData;
  certificate: CertificateSnapshotData;
  dnsProviderId: string | null;
  hostingProviderId: string | null;
  emailProviderId: string | null;
};

export type UpdateSnapshotParams = Partial<CreateSnapshotParams>;

export type SnapshotForMonitoring = {
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
  userEmail: string;
  userName: string;
};

/**
 * Get or create a snapshot for a tracked domain.
 * Returns the existing snapshot or creates an empty one.
 */
export async function getOrCreateSnapshot(trackedDomainId: string) {
  // Try to get existing snapshot
  const existing = await db
    .select()
    .from(domainSnapshots)
    .where(eq(domainSnapshots.trackedDomainId, trackedDomainId))
    .limit(1);

  if (existing.length > 0) {
    return existing[0];
  }

  // Create new empty snapshot
  const inserted = await db
    .insert(domainSnapshots)
    .values({
      trackedDomainId,
      registration: {},
      certificate: {},
      dnsProviderId: null,
      hostingProviderId: null,
      emailProviderId: null,
    })
    .onConflictDoNothing()
    .returning();

  if (inserted.length > 0) {
    logger.info("created initial snapshot", { trackedDomainId });
    return inserted[0];
  }

  // Race condition: another process created it, fetch again
  const [snapshot] = await db
    .select()
    .from(domainSnapshots)
    .where(eq(domainSnapshots.trackedDomainId, trackedDomainId))
    .limit(1);

  return snapshot;
}

/**
 * Create a new snapshot with initial data.
 * Returns the created snapshot.
 */
export async function createSnapshot(params: CreateSnapshotParams) {
  const {
    trackedDomainId,
    registration,
    certificate,
    dnsProviderId,
    hostingProviderId,
    emailProviderId,
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
    })
    .onConflictDoUpdate({
      target: domainSnapshots.trackedDomainId,
      set: {
        registration,
        certificate,
        dnsProviderId,
        hostingProviderId,
        emailProviderId,
        updatedAt: new Date(),
      },
    })
    .returning();

  logger.info("created snapshot", {
    trackedDomainId,
    hasRegistrar: !!registration.registrarProviderId,
    hasCA: !!certificate.caProviderId,
  });

  return inserted[0];
}

/**
 * Update an existing snapshot with new data.
 * Only updates fields that are provided.
 */
export async function updateSnapshot(
  trackedDomainId: string,
  params: UpdateSnapshotParams,
) {
  const updates: Record<string, unknown> = {
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

  const updated = await db
    .update(domainSnapshots)
    .set(updates)
    .where(eq(domainSnapshots.trackedDomainId, trackedDomainId))
    .returning();

  if (updated.length === 0) {
    logger.warn("snapshot not found for update", { trackedDomainId });
    return null;
  }

  logger.debug("updated snapshot", { trackedDomainId });
  return updated[0];
}

/**
 * Get all snapshots for verified, non-archived tracked domains.
 * Used by the monitoring job to check for changes.
 */
export async function getSnapshotsForMonitoring(): Promise<
  SnapshotForMonitoring[]
> {
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
      userEmail: users.email,
      userName: users.name,
    })
    .from(domainSnapshots)
    .innerJoin(
      userTrackedDomains,
      eq(domainSnapshots.trackedDomainId, userTrackedDomains.id),
    )
    .innerJoin(domains, eq(userTrackedDomains.domainId, domains.id))
    .innerJoin(users, eq(userTrackedDomains.userId, users.id))
    .where(
      and(
        eq(userTrackedDomains.verified, true),
        isNull(userTrackedDomains.archivedAt),
        // Only include domains that have snapshots (not empty)
        isNotNull(domainSnapshots.id),
      ),
    );

  return rows.map((row) => ({
    ...row,
    registration: row.registration as RegistrationSnapshotData,
    certificate: row.certificate as CertificateSnapshotData,
  }));
}

/**
 * Delete a snapshot for a tracked domain.
 * Used when a tracked domain is removed.
 */
export async function deleteSnapshot(trackedDomainId: string) {
  try {
    await db
      .delete(domainSnapshots)
      .where(eq(domainSnapshots.trackedDomainId, trackedDomainId));
    logger.debug("deleted snapshot", { trackedDomainId });
    return true;
  } catch (err) {
    logger.error("failed to delete snapshot", err, { trackedDomainId });
    return false;
  }
}

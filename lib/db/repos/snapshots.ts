import "server-only";

import { and, eq, isNull } from "drizzle-orm";
import { db } from "@/lib/db/client";
import {
  domainSnapshots,
  domains,
  users,
  userTrackedDomains,
} from "@/lib/db/schema";
import { createLogger } from "@/lib/logger/server";
import {
  CertificateSnapshotSchema,
  type CreateSnapshotParams,
  RegistrationSnapshotSchema,
  type SnapshotForMonitoring,
  type UpdateSnapshotParams,
} from "@/lib/schemas";

const logger = createLogger({ source: "snapshots" });

/**
 * Get or create a snapshot for a tracked domain.
 * Returns the existing snapshot or creates an empty one.
 * Uses onConflictDoNothing to handle concurrent creation gracefully.
 */
export async function getOrCreateSnapshot(
  trackedDomainId: string,
  retryCount = 0,
) {
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

  // Edge case: snapshot was deleted between conflict and re-fetch
  // This should be extremely rare but possible if a domain is removed during creation
  if (!snapshot) {
    if (retryCount >= 1) {
      const error = new Error(
        `Failed to create snapshot for tracked domain ${trackedDomainId} after retry`,
      );
      logger.error("Snapshot creation failed after retry", error, {
        trackedDomainId,
        retryCount,
      });
      throw error;
    }

    logger.warn("Snapshot disappeared after conflict, recreating", {
      trackedDomainId,
      retryCount,
    });
    // Recursively retry once - if this fails, let it throw
    return getOrCreateSnapshot(trackedDomainId, retryCount + 1);
  }

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

  if (!inserted || inserted.length === 0) {
    logger.error("failed to create snapshot - no row returned", {
      trackedDomainId,
    });
    throw new Error("Failed to create snapshot");
  }

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
 * Get all snapshot IDs for verified, non-archived tracked domains.
 * Used by the monitoring scheduler.
 */
export async function getMonitoredSnapshotIds(): Promise<string[]> {
  const rows = await db
    .select({
      trackedDomainId: domainSnapshots.trackedDomainId,
    })
    .from(domainSnapshots)
    .innerJoin(
      userTrackedDomains,
      eq(domainSnapshots.trackedDomainId, userTrackedDomains.id),
    )
    .where(
      and(
        eq(userTrackedDomains.verified, true),
        isNull(userTrackedDomains.archivedAt),
      ),
    );

  return rows.map((r) => r.trackedDomainId);
}

/**
 * Get full snapshot data for a single domain.
 * Used by the monitoring worker.
 */
export async function getSnapshot(
  trackedDomainId: string,
): Promise<SnapshotForMonitoring | null> {
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
    .where(eq(domainSnapshots.trackedDomainId, trackedDomainId))
    .limit(1);

  if (rows.length === 0) {
    return null;
  }

  const row = rows[0];

  // Validate JSONB data
  const registration = RegistrationSnapshotSchema.safeParse(row.registration);
  const certificate = CertificateSnapshotSchema.safeParse(row.certificate);

  if (!registration.success || !certificate.success) {
    logger.error(
      "Invalid snapshot data",
      registration.error || certificate.error,
      {
        trackedDomainId,
      },
    );
    return null;
  }

  return {
    ...row,
    registration: registration.data,
    certificate: certificate.data,
  };
}

/**
 * Get all snapshots for verified, non-archived tracked domains.
 * Used by the monitoring job to check for changes.
 * @deprecated Use getMonitoredSnapshotIds and getSnapshot in a fan-out pattern
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
      ),
    );

  // Filter and validate rows, skipping any with invalid JSONB data
  // This prevents one bad record from aborting the entire monitoring job
  const validRows: SnapshotForMonitoring[] = [];
  let skippedCount = 0;

  for (const row of rows) {
    // Validate JSONB data to ensure it matches expected shape
    const registration = RegistrationSnapshotSchema.safeParse(row.registration);
    const certificate = CertificateSnapshotSchema.safeParse(row.certificate);

    if (!registration.success) {
      logger.error(
        "Invalid registration snapshot data, skipping domain",
        registration.error,
        {
          trackedDomainId: row.trackedDomainId,
          domainName: row.domainName,
        },
      );
      skippedCount++;
      continue;
    }

    if (!certificate.success) {
      logger.error(
        "Invalid certificate snapshot data, skipping domain",
        certificate.error,
        {
          trackedDomainId: row.trackedDomainId,
          domainName: row.domainName,
        },
      );
      skippedCount++;
      continue;
    }

    validRows.push({
      ...row,
      registration: registration.data,
      certificate: certificate.data,
    });
  }

  if (skippedCount > 0) {
    logger.warn("Skipped domains with invalid snapshot data", {
      skippedCount,
      totalCount: rows.length,
      validCount: validRows.length,
    });
  }

  return validRows;
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

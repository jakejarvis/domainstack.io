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
import type {
  CreateSnapshotParams,
  SnapshotForMonitoring,
  UpdateSnapshotParams,
} from "@/lib/types";

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
      logger.warn(
        { trackedDomainId, attempt: retryCount },
        "snapshot creation failed after retry",
      );
      const error = new Error(
        `Failed to create snapshot for tracked domain ${trackedDomainId} after retry`,
      );
      throw error;
    }

    logger.warn(
      { trackedDomainId, attempt: retryCount },
      "snapshot disappeared after conflict, recreating",
    );
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
    logger.error(
      { trackedDomainId },
      "failed to create snapshot - no row returned",
    );
    throw new Error("Failed to create snapshot");
  }

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
    logger.warn({ trackedDomainId }, "snapshot not found for update");
    return null;
  }

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

  return rows[0];
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

    return true;
  } catch (err) {
    logger.error(
      { err, trackedDomainId },
      "failed to delete snapshot for domain",
    );
    return false;
  }
}

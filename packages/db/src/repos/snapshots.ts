import { and, eq, isNull } from "drizzle-orm";
import {
  type CertificateSnapshotData,
  domainSnapshots,
  domains,
  type RegistrationSnapshotData,
  users,
  userTrackedDomains,
} from "../schema";
import type { DbClient } from "../types";

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
};

export function createSnapshotsRepo(db: DbClient) {
  return {
    /**
     * Create a new snapshot with initial data.
     */
    async createSnapshot(
      params: CreateSnapshotParams,
      updateExisting = true,
    ): Promise<typeof domainSnapshots.$inferSelect | null> {
      const {
        trackedDomainId,
        registration = EMPTY_REGISTRATION,
        certificate = EMPTY_CERTIFICATE,
        dnsProviderId = null,
        hostingProviderId = null,
        emailProviderId = null,
      } = params;

      const values = {
        trackedDomainId,
        registration,
        certificate,
        dnsProviderId,
        hostingProviderId,
        emailProviderId,
      };

      if (!updateExisting) {
        const inserted = await db
          .insert(domainSnapshots)
          .values(values)
          .onConflictDoNothing()
          .returning();

        return inserted.length > 0 ? inserted[0] : null;
      }

      const inserted = await db
        .insert(domainSnapshots)
        .values(values)
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
        throw new Error("Failed to create snapshot");
      }

      return inserted[0];
    },

    /**
     * Update an existing snapshot with new data.
     */
    async updateSnapshot(
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
        return null;
      }

      return updated[0];
    },

    /**
     * Get all snapshot IDs for verified, non-archived tracked domains.
     */
    async getMonitoredSnapshotIds(): Promise<string[]> {
      const rows = await db
        .select({ trackedDomainId: domainSnapshots.trackedDomainId })
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
    },

    /**
     * Get verified, non-archived tracked domains that don't have snapshots yet.
     */
    async getVerifiedDomainsWithoutSnapshots(): Promise<
      Array<{ trackedDomainId: string; domainId: string }>
    > {
      const rows = await db
        .select({
          trackedDomainId: userTrackedDomains.id,
          domainId: userTrackedDomains.domainId,
        })
        .from(userTrackedDomains)
        .leftJoin(
          domainSnapshots,
          eq(userTrackedDomains.id, domainSnapshots.trackedDomainId),
        )
        .where(
          and(
            eq(userTrackedDomains.verified, true),
            isNull(userTrackedDomains.archivedAt),
            isNull(domainSnapshots.id),
          ),
        );

      return rows;
    },

    /**
     * Get full snapshot data for a single domain.
     */
    async getSnapshot(
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
    },
  };
}

export type SnapshotsRepo = ReturnType<typeof createSnapshotsRepo>;

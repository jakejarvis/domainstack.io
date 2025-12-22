import "server-only";

import { and, eq, isNull } from "drizzle-orm";
import { db } from "@/lib/db/client";
import {
  type CertificateSnapshotData,
  createSnapshot,
  type RegistrationSnapshotData,
} from "@/lib/db/repos/snapshots";
import { domains, userTrackedDomains } from "@/lib/db/schema";
import { inngest } from "@/lib/inngest/client";
import { createLogger } from "@/lib/logger/server";
import { getCertificates } from "@/server/services/certificates";
import { getHosting } from "@/server/services/hosting";
import { getRegistration } from "@/server/services/registration";

const logger = createLogger({ source: "backfill-snapshots" });

/**
 * One-time backfill job to create snapshots for all verified tracked domains.
 * This is needed when rolling out the change monitoring system to existing users.
 *
 * Run this job manually via Inngest dashboard or a one-time script.
 */
export const backfillSnapshots = inngest.createFunction(
  {
    id: "backfill-snapshots",
    retries: 0, // Don't retry the entire batch, handle failures per-domain
    concurrency: {
      limit: 1, // Only one backfill job at a time
    },
  },
  { event: "snapshot/backfill" },
  async ({ step, logger: inngestLogger }) => {
    inngestLogger.info("Starting snapshot backfill for verified domains");

    // Fetch all verified, non-archived domains that don't have snapshots yet
    const verifiedDomains = await step.run("fetch-domains", async () => {
      return await db
        .select({
          trackedDomainId: userTrackedDomains.id,
          domainId: userTrackedDomains.domainId,
          domainName: domains.name,
        })
        .from(userTrackedDomains)
        .innerJoin(domains, eq(userTrackedDomains.domainId, domains.id))
        .where(
          and(
            eq(userTrackedDomains.verified, true),
            isNull(userTrackedDomains.archivedAt),
          ),
        );
    });

    inngestLogger.info(
      `Found ${verifiedDomains.length} verified domains to backfill`,
    );

    const results = {
      total: verifiedDomains.length,
      success: 0,
      failed: 0,
      errors: [] as Array<{ domain: string; error: string }>,
    };

    for (const domainRecord of verifiedDomains) {
      try {
        inngestLogger.info(`Processing ${domainRecord.domainName}`);

        // Fetch fresh data for this domain
        const [registrationData, hostingData, certificatesData] =
          await step.run(`fetch-data-${domainRecord.domainName}`, async () => {
            return await Promise.all([
              getRegistration(domainRecord.domainName),
              getHosting(domainRecord.domainName),
              getCertificates(domainRecord.domainName),
            ]);
          });

        // Build registration snapshot
        let registrationSnapshot: RegistrationSnapshotData = {
          registrarProviderId: null,
          nameservers: [],
          transferLock: null,
          statuses: [],
        };

        if (registrationData.status === "registered") {
          registrationSnapshot = {
            registrarProviderId: registrationData.registrarProvider.id ?? null,
            nameservers: registrationData.nameservers || [],
            transferLock: registrationData.transferLock ?? null,
            statuses: (registrationData.statuses || []).map((s) =>
              typeof s === "string" ? s : s.status,
            ),
          };
        }

        // Build certificate snapshot
        let certificateSnapshot: CertificateSnapshotData = {
          caProviderId: null,
          issuer: "",
          validTo: new Date().toISOString(),
          fingerprint: null,
        };

        if (certificatesData.length > 0) {
          const leafCert = certificatesData[0];

          certificateSnapshot = {
            caProviderId: leafCert.caProvider.id ?? null,
            issuer: leafCert.issuer,
            validTo: new Date(leafCert.validTo).toISOString(),
            fingerprint: null,
          };
        }

        // Use provider IDs directly from hosting response
        const providerIds = {
          dns: hostingData?.dnsProvider?.id ?? null,
          hosting: hostingData?.hostingProvider?.id ?? null,
          email: hostingData?.emailProvider?.id ?? null,
        };

        // Create the snapshot
        await step.run(
          `create-snapshot-${domainRecord.domainName}`,
          async () => {
            return await createSnapshot({
              trackedDomainId: domainRecord.trackedDomainId,
              registration: registrationSnapshot,
              certificate: certificateSnapshot,
              dnsProviderId: providerIds.dns,
              hostingProviderId: providerIds.hosting,
              emailProviderId: providerIds.email,
            });
          },
        );

        results.success++;
        inngestLogger.info(
          `Successfully created snapshot for ${domainRecord.domainName}`,
        );
      } catch (err) {
        results.failed++;
        const errorMsg = err instanceof Error ? err.message : String(err);
        results.errors.push({
          domain: domainRecord.domainName,
          error: errorMsg,
        });
        logger.error("Failed to create snapshot for domain", err, {
          domainName: domainRecord.domainName,
          trackedDomainId: domainRecord.trackedDomainId,
        });
      }
    }

    inngestLogger.info("Snapshot backfill complete", results);
    return results;
  },
);

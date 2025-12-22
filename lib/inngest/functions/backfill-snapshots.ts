import "server-only";

import { eq, isNull } from "drizzle-orm";
import { db } from "@/lib/db/client";
import {
  type CertificateSnapshotData,
  createSnapshot,
  type RegistrationSnapshotData,
} from "@/lib/db/repos/snapshots";
import { domains, providers, userTrackedDomains } from "@/lib/db/schema";
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
          eq(userTrackedDomains.verified, true) &&
            isNull(userTrackedDomains.archivedAt),
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
            registrarProviderId:
              registrationData.registrarProvider.name || null,
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

          // Resolve CA provider ID from name
          const caProviderId = await step.run(
            `resolve-ca-id-${domainRecord.domainName}`,
            async () => {
              if (!leafCert.caProvider?.name) return null;

              const providersData = await db
                .select({ id: providers.id })
                .from(providers)
                .where(eq(providers.name, leafCert.caProvider.name))
                .limit(1);

              return providersData[0]?.id || null;
            },
          );

          certificateSnapshot = {
            caProviderId,
            issuer: leafCert.issuer,
            validTo: new Date(leafCert.validTo).toISOString(),
            fingerprint: null,
          };
        }

        // Resolve provider IDs from hosting data
        const providerIds = await step.run(
          `resolve-provider-ids-${domainRecord.domainName}`,
          async () => {
            if (!hostingData) {
              return { dns: null, hosting: null, email: null };
            }

            const names = [
              hostingData.dnsProvider?.name,
              hostingData.hostingProvider?.name,
              hostingData.emailProvider?.name,
            ].filter((n): n is string => n !== null);

            if (names.length === 0) {
              return { dns: null, hosting: null, email: null };
            }

            const providersData = await db
              .select({ name: providers.name, id: providers.id })
              .from(providers)
              .where(eq(providers.name, names[0]));

            const nameToId = Object.fromEntries(
              providersData.map((p) => [p.name, p.id]),
            );

            return {
              dns: hostingData.dnsProvider?.name
                ? nameToId[hostingData.dnsProvider.name] || null
                : null,
              hosting: hostingData.hostingProvider?.name
                ? nameToId[hostingData.hostingProvider.name] || null
                : null,
              email: hostingData.emailProvider?.name
                ? nameToId[hostingData.emailProvider.name] || null
                : null,
            };
          },
        );

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

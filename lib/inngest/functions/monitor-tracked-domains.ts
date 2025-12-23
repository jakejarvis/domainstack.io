import "server-only";

import { createHash } from "node:crypto";
import { inArray } from "drizzle-orm";
import { CertificateChangeEmail } from "@/emails/certificate-change";
import { ProviderChangeEmail } from "@/emails/provider-change";
import { RegistrationChangeEmail } from "@/emails/registration-change";
import {
  detectCertificateChanges,
  detectProviderChanges,
  detectRegistrationChanges,
} from "@/lib/change-detection";
import { db } from "@/lib/db/client";
import {
  createNotification,
  updateNotificationResendId,
} from "@/lib/db/repos/notifications";
import {
  getSnapshotsForMonitoring,
  updateSnapshot,
} from "@/lib/db/repos/snapshots";
import { findTrackedDomainById } from "@/lib/db/repos/tracked-domains";
import { getOrCreateUserNotificationPreferences } from "@/lib/db/repos/user-notification-preferences";
import { providers } from "@/lib/db/schema";
import { inngest } from "@/lib/inngest/client";
import { createLogger } from "@/lib/logger/server";
import { generateIdempotencyKey } from "@/lib/notifications";
import { sendPrettyEmail } from "@/lib/resend";
import type {
  CertificateChange,
  CertificateSnapshotData,
  ProviderChange,
  RegistrationChange,
  RegistrationSnapshotData,
} from "@/lib/schemas";
import { getCertificates } from "@/server/services/certificates";
import { getHosting } from "@/server/services/hosting";
import { getRegistration } from "@/server/services/registration";

const logger = createLogger({ source: "monitor-tracked-domains" });

/**
 * Cron job to monitor tracked domains for changes.
 * Runs every 4 hours and checks for registration, provider, and certificate changes.
 */
export const monitorTrackedDomains = inngest.createFunction(
  {
    id: "monitor-tracked-domains",
    retries: 3,
    concurrency: {
      limit: 1,
    },
  },
  { cron: "0 */4 * * *" }, // Every 4 hours
  async ({ step, logger: inngestLogger }) => {
    inngestLogger.info("Starting tracked domain monitoring");

    // Fetch all snapshots for verified, non-archived domains
    const snapshots = await step.run("fetch-snapshots", async () => {
      return await getSnapshotsForMonitoring();
    });

    inngestLogger.info(`Monitoring ${snapshots.length} tracked domains`);

    const results = {
      total: snapshots.length,
      registrationChanges: 0,
      providerChanges: 0,
      certificateChanges: 0,
      errors: 0,
      failedDomains: [] as Array<{ domainName: string; error: string }>,
    };

    for (const snapshot of snapshots) {
      try {
        // Fetch fresh data for this domain
        const [registrationData, hostingData, certificatesData] =
          await step.run(`fetch-data-${snapshot.domainName}`, async () => {
            return await Promise.all([
              getRegistration(snapshot.domainName),
              getHosting(snapshot.domainName),
              getCertificates(snapshot.domainName),
            ]);
          });

        // Check registration changes
        if (registrationData.status === "registered") {
          const currentRegistration: RegistrationSnapshotData = {
            registrarProviderId: registrationData.registrarProvider.id ?? null,
            nameservers: registrationData.nameservers || [],
            transferLock: registrationData.transferLock ?? null,
            // Extract status strings from status objects
            statuses: (registrationData.statuses || []).map((s) =>
              typeof s === "string" ? s : s.status,
            ),
          };

          const registrationChange = detectRegistrationChanges(
            snapshot.registration,
            currentRegistration,
          );

          if (registrationChange) {
            const sent = await step.run(
              `notify-registration-${snapshot.domainName}`,
              async () => {
                return await handleRegistrationChange(
                  snapshot.trackedDomainId,
                  snapshot.domainName,
                  snapshot.userId,
                  snapshot.userName,
                  snapshot.userEmail,
                  registrationChange,
                );
              },
            );

            if (sent) {
              results.registrationChanges++;
              // Update snapshot with new values
              await step.run(
                `update-registration-${snapshot.domainName}`,
                async () => {
                  return await updateSnapshot(snapshot.trackedDomainId, {
                    registration: currentRegistration,
                  });
                },
              );
            }
          }
        }

        // Check provider changes
        if (hostingData) {
          // Use provider IDs directly from hosting response
          const currentProviderIds = {
            dns: hostingData.dnsProvider?.id ?? null,
            hosting: hostingData.hostingProvider?.id ?? null,
            email: hostingData.emailProvider?.id ?? null,
          };

          const providerChange = detectProviderChanges(
            {
              dnsProviderId: snapshot.dnsProviderId,
              hostingProviderId: snapshot.hostingProviderId,
              emailProviderId: snapshot.emailProviderId,
            },
            {
              dnsProviderId: currentProviderIds.dns,
              hostingProviderId: currentProviderIds.hosting,
              emailProviderId: currentProviderIds.email,
            },
          );

          if (providerChange) {
            // Fetch provider names for notification
            const providerIds = [
              snapshot.dnsProviderId,
              snapshot.hostingProviderId,
              snapshot.emailProviderId,
              currentProviderIds.dns,
              currentProviderIds.hosting,
              currentProviderIds.email,
            ].filter((id): id is string => id !== null);

            const providerNames = await step.run(
              `fetch-provider-names-${snapshot.domainName}`,
              async () => {
                if (providerIds.length === 0) return {};

                const providersData = await db
                  .select({ id: providers.id, name: providers.name })
                  .from(providers)
                  .where(inArray(providers.id, providerIds));

                return Object.fromEntries(
                  providersData.map((p) => [p.id, p.name]),
                );
              },
            );

            // Populate provider names in the change object
            const enrichedChange: ProviderChange = {
              ...providerChange,
              previousDnsProvider: providerChange.previousDnsProviderId
                ? providerNames[providerChange.previousDnsProviderId] || null
                : null,
              newDnsProvider: providerChange.newDnsProviderId
                ? providerNames[providerChange.newDnsProviderId] || null
                : null,
              previousHostingProvider: providerChange.previousHostingProviderId
                ? providerNames[providerChange.previousHostingProviderId] ||
                  null
                : null,
              newHostingProvider: providerChange.newHostingProviderId
                ? providerNames[providerChange.newHostingProviderId] || null
                : null,
              previousEmailProvider: providerChange.previousEmailProviderId
                ? providerNames[providerChange.previousEmailProviderId] || null
                : null,
              newEmailProvider: providerChange.newEmailProviderId
                ? providerNames[providerChange.newEmailProviderId] || null
                : null,
            };

            const sent = await step.run(
              `notify-provider-${snapshot.domainName}`,
              async () => {
                return await handleProviderChange(
                  snapshot.trackedDomainId,
                  snapshot.domainName,
                  snapshot.userId,
                  snapshot.userName,
                  snapshot.userEmail,
                  enrichedChange,
                );
              },
            );

            if (sent) {
              results.providerChanges++;
              // Update snapshot with new provider IDs
              await step.run(
                `update-providers-${snapshot.domainName}`,
                async () => {
                  return await updateSnapshot(snapshot.trackedDomainId, {
                    dnsProviderId: currentProviderIds.dns,
                    hostingProviderId: currentProviderIds.hosting,
                    emailProviderId: currentProviderIds.email,
                  });
                },
              );
            }
          }
        }

        // Check certificate changes
        if (certificatesData.length > 0) {
          const leafCert = certificatesData[0]; // First cert is the leaf

          const currentCertificate: CertificateSnapshotData = {
            caProviderId: leafCert.caProvider.id ?? null,
            issuer: leafCert.issuer,
            validTo: new Date(leafCert.validTo).toISOString(),
            fingerprint: null, // We don't store fingerprints currently
          };

          const certificateChange = detectCertificateChanges(
            snapshot.certificate,
            currentCertificate,
          );

          if (certificateChange) {
            // Fetch CA provider names
            const caIds = [
              certificateChange.previousCAProviderId,
              certificateChange.newCAProviderId,
            ].filter((id): id is string => id !== null);

            const caProviderNames = await step.run(
              `fetch-ca-names-${snapshot.domainName}`,
              async () => {
                if (caIds.length === 0) return {};

                const providersData = await db
                  .select({ id: providers.id, name: providers.name })
                  .from(providers)
                  .where(inArray(providers.id, caIds));

                return Object.fromEntries(
                  providersData.map((p) => [p.id, p.name]),
                );
              },
            );

            // Populate CA provider names
            const enrichedChange: CertificateChange = {
              ...certificateChange,
              previousCAProvider: certificateChange.previousCAProviderId
                ? caProviderNames[certificateChange.previousCAProviderId] ||
                  null
                : null,
              newCAProvider: certificateChange.newCAProviderId
                ? caProviderNames[certificateChange.newCAProviderId] || null
                : null,
            };

            const sent = await step.run(
              `notify-certificate-${snapshot.domainName}`,
              async () => {
                return await handleCertificateChange(
                  snapshot.trackedDomainId,
                  snapshot.domainName,
                  snapshot.userId,
                  snapshot.userName,
                  snapshot.userEmail,
                  enrichedChange,
                  currentCertificate.validTo,
                );
              },
            );

            if (sent) {
              results.certificateChanges++;
              // Update snapshot with new certificate data
              await step.run(
                `update-certificate-${snapshot.domainName}`,
                async () => {
                  return await updateSnapshot(snapshot.trackedDomainId, {
                    certificate: currentCertificate,
                  });
                },
              );
            }
          }
        }
      } catch (err) {
        const errorMessage =
          err instanceof Error ? err.message : "Unknown error";
        logger.error("Error monitoring domain", err, {
          domainName: snapshot.domainName,
          trackedDomainId: snapshot.trackedDomainId,
        });
        results.errors++;
        results.failedDomains.push({
          domainName: snapshot.domainName,
          error: errorMessage,
        });
      }
    }

    inngestLogger.info("Tracked domain monitoring complete", results);
    return results;
  },
);

async function handleRegistrationChange(
  trackedDomainId: string,
  domainName: string,
  userId: string,
  userName: string,
  userEmail: string,
  change: RegistrationChange,
): Promise<boolean> {
  // Check notification preferences (per-domain override > global)
  const trackedDomain = await findTrackedDomainById(trackedDomainId);
  if (!trackedDomain) {
    logger.error("Tracked domain not found", { trackedDomainId });
    return false;
  }

  // Check per-domain override first
  const shouldNotify =
    trackedDomain.notificationOverrides.registrationChanges !== undefined
      ? trackedDomain.notificationOverrides.registrationChanges
      : (await getOrCreateUserNotificationPreferences(userId))
          .registrationChanges;

  if (!shouldNotify) {
    logger.debug("Registration change notification disabled", {
      domainName,
      userId,
    });
    return false;
  }

  // Generate a stable idempotency key BEFORE any operations
  const idempotencyKey = generateIdempotencyKey(
    trackedDomainId,
    "registration_change",
    generateChangeHash(change),
  );

  try {
    // Send email first with idempotency key
    // Resend will dedupe retries, so we only create the notification record after success
    const { data, error } = await sendPrettyEmail(
      {
        to: userEmail,
        subject: `⚠️ Registration changes detected for ${domainName}`,
        react: RegistrationChangeEmail({
          userName: userName.split(" ")[0] || "there",
          domainName,
          changes: {
            registrarChanged: change.registrarChanged,
            nameserversChanged: change.nameserversChanged,
            transferLockChanged: change.transferLockChanged,
            statusesChanged: change.statusesChanged,
            previousRegistrar: change.previousRegistrar || undefined,
            newRegistrar: change.newRegistrar || undefined,
            previousNameservers: change.previousNameservers,
            newNameservers: change.newNameservers,
            previousTransferLock: change.previousTransferLock || undefined,
            newTransferLock: change.newTransferLock || undefined,
            previousStatuses: change.previousStatuses,
            newStatuses: change.newStatuses,
          },
        }),
      },
      {
        idempotencyKey,
      },
    );

    if (error) {
      logger.error("Failed to send registration change email", error, {
        domainName,
        userId,
        idempotencyKey,
      });
      // Throw to trigger Inngest retry - idempotency key prevents duplicates
      throw new Error(`Resend error: ${error.message}`);
    }

    // Only create notification record after successful send
    await createNotification({
      trackedDomainId,
      type: "registration_change",
    });

    // Store Resend ID for troubleshooting
    if (data?.id) {
      await updateNotificationResendId(
        trackedDomainId,
        "registration_change",
        data.id,
      );
    }

    logger.info("Sent registration change notification", {
      domainName,
      userId,
      emailId: data?.id,
      idempotencyKey,
    });

    return true;
  } catch (err) {
    logger.error("Error sending registration change notification", err, {
      domainName,
      userId,
      idempotencyKey,
    });
    // Re-throw to trigger Inngest retry
    throw err;
  }
}

async function handleProviderChange(
  trackedDomainId: string,
  domainName: string,
  userId: string,
  userName: string,
  userEmail: string,
  change: ProviderChange,
): Promise<boolean> {
  // Check notification preferences (per-domain override > global)
  const trackedDomain = await findTrackedDomainById(trackedDomainId);
  if (!trackedDomain) {
    logger.error("Tracked domain not found", { trackedDomainId });
    return false;
  }

  // Check per-domain override first
  const shouldNotify =
    trackedDomain.notificationOverrides.providerChanges !== undefined
      ? trackedDomain.notificationOverrides.providerChanges
      : (await getOrCreateUserNotificationPreferences(userId)).providerChanges;

  if (!shouldNotify) {
    logger.debug("Provider change notification disabled", {
      domainName,
      userId,
    });
    return false;
  }

  // Generate a stable idempotency key BEFORE any operations
  const idempotencyKey = generateIdempotencyKey(
    trackedDomainId,
    "provider_change",
    generateChangeHash(change),
  );

  try {
    // Send email first with idempotency key
    // Resend will dedupe retries, so we only create the notification record after success
    const { data, error } = await sendPrettyEmail(
      {
        to: userEmail,
        subject: `🔄 Provider changes detected for ${domainName}`,
        react: ProviderChangeEmail({
          userName: userName.split(" ")[0] || "there",
          domainName,
          changes: change,
        }),
      },
      {
        idempotencyKey,
      },
    );

    if (error) {
      logger.error("Failed to send provider change email", error, {
        domainName,
        userId,
        idempotencyKey,
      });
      // Throw to trigger Inngest retry - idempotency key prevents duplicates
      throw new Error(`Resend error: ${error.message}`);
    }

    // Only create notification record after successful send
    await createNotification({
      trackedDomainId,
      type: "provider_change",
    });

    // Store Resend ID for troubleshooting
    if (data?.id) {
      await updateNotificationResendId(
        trackedDomainId,
        "provider_change",
        data.id,
      );
    }

    logger.info("Sent provider change notification", {
      domainName,
      userId,
      emailId: data?.id,
      idempotencyKey,
    });

    return true;
  } catch (err) {
    logger.error("Error sending provider change notification", err, {
      domainName,
      userId,
      idempotencyKey,
    });
    // Re-throw to trigger Inngest retry
    throw err;
  }
}

async function handleCertificateChange(
  trackedDomainId: string,
  domainName: string,
  userId: string,
  userName: string,
  userEmail: string,
  change: CertificateChange,
  newValidTo: string,
): Promise<boolean> {
  // Check notification preferences (per-domain override > global)
  const trackedDomain = await findTrackedDomainById(trackedDomainId);
  if (!trackedDomain) {
    logger.error("Tracked domain not found", { trackedDomainId });
    return false;
  }

  // Check per-domain override first
  const shouldNotify =
    trackedDomain.notificationOverrides.certificateChanges !== undefined
      ? trackedDomain.notificationOverrides.certificateChanges
      : (await getOrCreateUserNotificationPreferences(userId))
          .certificateChanges;

  if (!shouldNotify) {
    logger.debug("Certificate change notification disabled", {
      domainName,
      userId,
    });
    return false;
  }

  // Generate a stable idempotency key BEFORE any operations
  const idempotencyKey = generateIdempotencyKey(
    trackedDomainId,
    "certificate_change",
    generateChangeHash(change),
  );

  try {
    // Send email first with idempotency key
    // Resend will dedupe retries, so we only create the notification record after success
    const { data, error } = await sendPrettyEmail(
      {
        to: userEmail,
        subject: `🔒 Certificate changes detected for ${domainName}`,
        react: CertificateChangeEmail({
          userName: userName.split(" ")[0] || "there",
          domainName,
          changes: change,
          newValidTo,
        }),
      },
      {
        idempotencyKey,
      },
    );

    if (error) {
      logger.error("Failed to send certificate change email", error, {
        domainName,
        userId,
        idempotencyKey,
      });
      // Throw to trigger Inngest retry - idempotency key prevents duplicates
      throw new Error(`Resend error: ${error.message}`);
    }

    // Only create notification record after successful send
    await createNotification({
      trackedDomainId,
      type: "certificate_change",
    });

    // Store Resend ID for troubleshooting
    if (data?.id) {
      await updateNotificationResendId(
        trackedDomainId,
        "certificate_change",
        data.id,
      );
    }

    logger.info("Sent certificate change notification", {
      domainName,
      userId,
      emailId: data?.id,
      idempotencyKey,
    });

    return true;
  } catch (err) {
    logger.error("Error sending certificate change notification", err, {
      domainName,
      userId,
      idempotencyKey,
    });
    // Re-throw to trigger Inngest retry
    throw err;
  }
}

/**
 * Generate a hash of the changes to use as a discriminator for idempotency.
 * This ensures that:
 * 1. Resend's 24h idempotency works correctly (same change = same key)
 * 2. Different changes (even within 24h) generate different keys and are sent
 */
function generateChangeHash(change: unknown): string {
  return createHash("sha256")
    .update(JSON.stringify(change))
    .digest("hex")
    .slice(0, 16); // Short hash is enough
}

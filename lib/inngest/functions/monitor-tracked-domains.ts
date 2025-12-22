import "server-only";

import { eq, inArray } from "drizzle-orm";
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
  hasNotificationBeenSent,
  updateNotificationResendId,
} from "@/lib/db/repos/notifications";
import {
  type CertificateSnapshotData,
  getSnapshotsForMonitoring,
  type RegistrationSnapshotData,
  updateSnapshot,
} from "@/lib/db/repos/snapshots";
import { getOrCreateUserNotificationPreferences } from "@/lib/db/repos/user-notification-preferences";
import { providers } from "@/lib/db/schema";
import { inngest } from "@/lib/inngest/client";
import { createLogger } from "@/lib/logger/server";
import { sendPrettyEmail } from "@/lib/resend";
import type {
  CertificateChange,
  ProviderChange,
  RegistrationChange,
} from "@/lib/schemas/internal/changes";
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
            registrarProviderId:
              registrationData.registrarProvider.name || null,
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
          // Resolve provider IDs from names
          const currentProviderIds = await step.run(
            `resolve-provider-ids-${snapshot.domainName}`,
            async () => {
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
                .where(inArray(providers.name, names));

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

          // Resolve CA provider ID from name
          const currentCAProviderId = await step.run(
            `resolve-ca-id-${snapshot.domainName}`,
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

          const currentCertificate: CertificateSnapshotData = {
            caProviderId: currentCAProviderId,
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
        logger.error("Error monitoring domain", err, {
          domainName: snapshot.domainName,
          trackedDomainId: snapshot.trackedDomainId,
        });
        results.errors++;
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
  // Check notification preferences
  const prefs = await getOrCreateUserNotificationPreferences(userId);
  if (!prefs.registrationChanges) {
    logger.debug("Registration change notification disabled", {
      domainName,
      userId,
    });
    return false;
  }

  // Check if already notified
  const alreadySent = await hasNotificationBeenSent(
    trackedDomainId,
    "registration_change",
  );
  if (alreadySent) {
    return false;
  }

  // Create notification record
  await createNotification({
    trackedDomainId,
    type: "registration_change",
  });

  // Send email
  const { data, error } = await sendPrettyEmail({
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
  });

  if (error) {
    logger.error("Failed to send registration change email", error, {
      domainName,
      userEmail,
    });
    return false;
  }

  if (data?.id) {
    await updateNotificationResendId(
      trackedDomainId,
      "registration_change",
      data.id,
    );
  }

  logger.info("Sent registration change notification", {
    domainName,
    userEmail,
    emailId: data?.id,
  });

  return true;
}

async function handleProviderChange(
  trackedDomainId: string,
  domainName: string,
  userId: string,
  userName: string,
  userEmail: string,
  change: ProviderChange,
): Promise<boolean> {
  // Check notification preferences
  const prefs = await getOrCreateUserNotificationPreferences(userId);
  if (!prefs.providerChanges) {
    logger.debug("Provider change notification disabled", {
      domainName,
      userId,
    });
    return false;
  }

  // Check if already notified
  const alreadySent = await hasNotificationBeenSent(
    trackedDomainId,
    "provider_change",
  );
  if (alreadySent) {
    return false;
  }

  // Create notification record
  await createNotification({
    trackedDomainId,
    type: "provider_change",
  });

  // Send email
  const { data, error } = await sendPrettyEmail({
    to: userEmail,
    subject: `🔄 Provider changes detected for ${domainName}`,
    react: ProviderChangeEmail({
      userName: userName.split(" ")[0] || "there",
      domainName,
      changes: change,
    }),
  });

  if (error) {
    logger.error("Failed to send provider change email", error, {
      domainName,
      userEmail,
    });
    return false;
  }

  if (data?.id) {
    await updateNotificationResendId(
      trackedDomainId,
      "provider_change",
      data.id,
    );
  }

  logger.info("Sent provider change notification", {
    domainName,
    userEmail,
    emailId: data?.id,
  });

  return true;
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
  // Check notification preferences
  const prefs = await getOrCreateUserNotificationPreferences(userId);
  if (!prefs.certificateChanges) {
    logger.debug("Certificate change notification disabled", {
      domainName,
      userId,
    });
    return false;
  }

  // Check if already notified
  const alreadySent = await hasNotificationBeenSent(
    trackedDomainId,
    "certificate_change",
  );
  if (alreadySent) {
    return false;
  }

  // Create notification record
  await createNotification({
    trackedDomainId,
    type: "certificate_change",
  });

  // Send email
  const { data, error } = await sendPrettyEmail({
    to: userEmail,
    subject: `🔒 Certificate changes detected for ${domainName}`,
    react: CertificateChangeEmail({
      userName: userName.split(" ")[0] || "there",
      domainName,
      changes: change,
      newValidTo,
    }),
  });

  if (error) {
    logger.error("Failed to send certificate change email", error, {
      domainName,
      userEmail,
    });
    return false;
  }

  if (data?.id) {
    await updateNotificationResendId(
      trackedDomainId,
      "certificate_change",
      data.id,
    );
  }

  logger.info("Sent certificate change notification", {
    domainName,
    userEmail,
    emailId: data?.id,
  });

  return true;
}

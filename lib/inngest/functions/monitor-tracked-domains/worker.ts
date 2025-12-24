import "server-only";

import { createHash } from "node:crypto";
import type { Logger } from "inngest";
import { CertificateChangeEmail } from "@/emails/certificate-change";
import { ProviderChangeEmail } from "@/emails/provider-change";
import { RegistrationChangeEmail } from "@/emails/registration-change";
import {
  detectCertificateChanges,
  detectProviderChanges,
  detectRegistrationChanges,
} from "@/lib/change-detection";
import { getProviderNames } from "@/lib/db/repos/providers";
import { getSnapshot, updateSnapshot } from "@/lib/db/repos/snapshots";
import { inngest } from "@/lib/inngest/client";
import { INNGEST_EVENTS } from "@/lib/inngest/events";
import {
  determineNotificationChannels,
  sendNotification,
} from "@/lib/inngest/functions/notifications-helper";
import { generateIdempotencyKey } from "@/lib/notifications";
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

/**
 * Worker function to monitor a single tracked domain.
 * Triggered by the scheduler.
 */
export const monitorTrackedDomainsWorker = inngest.createFunction(
  {
    id: "monitor-tracked-domains-worker",
    retries: 3,
    concurrency: {
      limit: 5, // Process 5 domains in parallel to respect external API limits
    },
  },
  { event: INNGEST_EVENTS.MONITOR_CHANGES },
  async ({ event, step, logger: inngestLogger }) => {
    const { trackedDomainId } = event.data;

    // Fetch snapshot data
    const snapshot = await step.run("fetch-snapshot", async () => {
      return await getSnapshot(trackedDomainId);
    });

    if (!snapshot) {
      inngestLogger.warn("Snapshot not found, skipping", { trackedDomainId });
      return { skipped: true, reason: "snapshot_not_found" };
    }

    const { domainName, userId, userName, userEmail } = snapshot;

    inngestLogger.info(`Monitoring domain: ${domainName}`, { trackedDomainId });

    try {
      // Fetch fresh data for this domain
      const [registrationData, hostingData, certificatesData] = await step.run(
        "fetch-live-data",
        async () => {
          const opts = { skipScheduling: true };
          return await Promise.all([
            getRegistration(domainName, opts),
            getHosting(domainName, opts),
            getCertificates(domainName, opts),
          ]);
        },
      );

      const results = {
        registrationChanges: false,
        providerChanges: false,
        certificateChanges: false,
      };

      // Check registration changes
      if (registrationData.status === "registered") {
        const currentRegistration: RegistrationSnapshotData = {
          registrarProviderId: registrationData.registrarProvider?.id ?? null,
          nameservers: registrationData.nameservers || [],
          transferLock: registrationData.transferLock ?? null,
          statuses: (registrationData.statuses || []).map((s) =>
            typeof s === "string" ? s : s.status,
          ),
        };

        const registrationChange = detectRegistrationChanges(
          snapshot.registration,
          currentRegistration,
        );

        if (registrationChange) {
          const sent = await step.run("notify-registration", async () => {
            return await handleRegistrationChange(
              trackedDomainId,
              domainName,
              userId,
              userName,
              userEmail,
              registrationChange,
              inngestLogger,
            );
          });

          if (sent) {
            results.registrationChanges = true;
            await step.run("update-registration-snapshot", async () => {
              return await updateSnapshot(trackedDomainId, {
                registration: currentRegistration,
              });
            });
          }
        }
      }

      // Check provider changes
      if (hostingData) {
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
            "fetch-provider-names",
            async () => {
              if (providerIds.length === 0) return {};
              const names = await getProviderNames(providerIds);
              return Object.fromEntries(names);
            },
          );

          const enrichedChange: ProviderChange = {
            ...providerChange,
            previousDnsProvider: providerChange.previousDnsProviderId
              ? providerNames[providerChange.previousDnsProviderId] || null
              : null,
            newDnsProvider: providerChange.newDnsProviderId
              ? providerNames[providerChange.newDnsProviderId] || null
              : null,
            previousHostingProvider: providerChange.previousHostingProviderId
              ? providerNames[providerChange.previousHostingProviderId] || null
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

          const sent = await step.run("notify-provider", async () => {
            return await handleProviderChange(
              trackedDomainId,
              domainName,
              userId,
              userName,
              userEmail,
              enrichedChange,
              inngestLogger,
            );
          });

          if (sent) {
            results.providerChanges = true;
            await step.run("update-provider-snapshot", async () => {
              return await updateSnapshot(trackedDomainId, {
                dnsProviderId: currentProviderIds.dns,
                hostingProviderId: currentProviderIds.hosting,
                emailProviderId: currentProviderIds.email,
              });
            });
          }
        }
      }

      // Check certificate changes
      if (certificatesData.length > 0) {
        const leafCert = certificatesData[0]; // First cert is the leaf

        const currentCertificate: CertificateSnapshotData = {
          caProviderId: leafCert.caProvider?.id ?? null,
          issuer: leafCert.issuer,
          validTo: new Date(leafCert.validTo).toISOString(),
          fingerprint: null,
        };

        const certificateChange = detectCertificateChanges(
          snapshot.certificate,
          currentCertificate,
        );

        if (certificateChange) {
          const caIds = [
            certificateChange.previousCaProviderId,
            certificateChange.newCaProviderId,
          ].filter((id): id is string => id !== null);

          const caProviderNames = await step.run("fetch-ca-names", async () => {
            if (caIds.length === 0) return {};
            const names = await getProviderNames(caIds);
            return Object.fromEntries(names);
          });

          const enrichedChange: CertificateChange = {
            ...certificateChange,
            previousCaProvider: certificateChange.previousCaProviderId
              ? caProviderNames[certificateChange.previousCaProviderId] || null
              : null,
            newCaProvider: certificateChange.newCaProviderId
              ? caProviderNames[certificateChange.newCaProviderId] || null
              : null,
          };

          const sent = await step.run("notify-certificate", async () => {
            return await handleCertificateChange(
              trackedDomainId,
              domainName,
              userId,
              userName,
              userEmail,
              enrichedChange,
              currentCertificate.validTo,
              inngestLogger,
            );
          });

          if (sent) {
            results.certificateChanges = true;
            await step.run("update-certificate-snapshot", async () => {
              return await updateSnapshot(trackedDomainId, {
                certificate: currentCertificate,
              });
            });
          }
        }
      }

      return results;
    } catch (err) {
      inngestLogger.error("Error monitoring domain", err, {
        domainName,
        trackedDomainId,
      });
      throw err; // Allow Inngest to retry this specific domain
    }
  },
);

// --- Notification Helpers (copied from original) ---

function generateChangeHash(change: unknown): string {
  return createHash("sha256")
    .update(JSON.stringify(change))
    .digest("hex")
    .slice(0, 16);
}

async function handleRegistrationChange(
  trackedDomainId: string,
  domainName: string,
  userId: string,
  userName: string,
  userEmail: string,
  change: RegistrationChange,
  logger: Logger,
): Promise<boolean> {
  const { shouldSendEmail, shouldSendInApp } =
    await determineNotificationChannels(
      userId,
      trackedDomainId,
      "registrationChanges",
      "registrationChangesInApp",
      "registrationChanges",
      "registrationChangesInApp",
    );

  if (!shouldSendEmail && !shouldSendInApp) return false;

  // Resolve provider names without mutating the input
  let previousRegistrar = change.previousRegistrar;
  let newRegistrar = change.newRegistrar;

  if (change.registrarChanged) {
    const ids = [change.previousRegistrar, change.newRegistrar].filter(
      (id): id is string => !!id,
    );
    const names = await getProviderNames(ids);

    if (change.previousRegistrar) {
      previousRegistrar =
        names.get(change.previousRegistrar) ?? change.previousRegistrar;
    }
    if (change.newRegistrar) {
      newRegistrar = names.get(change.newRegistrar) ?? change.newRegistrar;
    }
  }

  const idempotencyKey = generateIdempotencyKey(
    trackedDomainId,
    "registration_change",
    generateChangeHash(change),
  );

  const title = `Registration changes detected for ${domainName}`;
  const subject = `⚠️ ${title}`;
  const changesList = [
    change.registrarChanged && "registrar",
    change.nameserversChanged && "nameservers",
    change.transferLockChanged && "transfer lock",
    change.statusesChanged && "statuses",
  ]
    .filter(Boolean)
    .join(", ");
  const message = `Your domain ${domainName} has registration changes: ${changesList}.`;

  return await sendNotification(
    {
      userId,
      userEmail,
      trackedDomainId,
      domainName,
      notificationType: "registration_change",
      title,
      message,
      idempotencyKey,
      emailSubject: subject,
      emailComponent: RegistrationChangeEmail({
        userName: userName.split(" ")[0] || "there",
        domainName,
        changes: {
          registrarChanged: change.registrarChanged,
          nameserversChanged: change.nameserversChanged,
          transferLockChanged: change.transferLockChanged,
          statusesChanged: change.statusesChanged,
          previousRegistrar: previousRegistrar || undefined,
          newRegistrar: newRegistrar || undefined,
          previousNameservers: change.previousNameservers,
          newNameservers: change.newNameservers,
          previousTransferLock: change.previousTransferLock || undefined,
          newTransferLock: change.newTransferLock || undefined,
          previousStatuses: change.previousStatuses,
          newStatuses: change.newStatuses,
        },
      }),
      logger,
    },
    shouldSendEmail,
    shouldSendInApp,
  );
}

async function handleProviderChange(
  trackedDomainId: string,
  domainName: string,
  userId: string,
  userName: string,
  userEmail: string,
  change: ProviderChange,
  logger: Logger,
): Promise<boolean> {
  const { shouldSendEmail, shouldSendInApp } =
    await determineNotificationChannels(
      userId,
      trackedDomainId,
      "providerChanges",
      "providerChangesInApp",
      "providerChanges",
      "providerChangesInApp",
    );

  if (!shouldSendEmail && !shouldSendInApp) return false;

  const idempotencyKey = generateIdempotencyKey(
    trackedDomainId,
    "provider_change",
    generateChangeHash(change),
  );

  const title = `Provider changes detected for ${domainName}`;
  const subject = `🔄 ${title}`;
  const changesList = [
    change.dnsProviderChanged && "DNS",
    change.hostingProviderChanged && "hosting",
    change.emailProviderChanged && "email",
  ]
    .filter(Boolean)
    .join(", ");
  const message = `Your domain ${domainName} has provider changes: ${changesList}.`;

  return await sendNotification(
    {
      userId,
      userEmail,
      trackedDomainId,
      domainName,
      notificationType: "provider_change",
      title,
      message,
      idempotencyKey,
      emailSubject: subject,
      emailComponent: ProviderChangeEmail({
        userName: userName.split(" ")[0] || "there",
        domainName,
        changes: change,
      }),
      logger,
    },
    shouldSendEmail,
    shouldSendInApp,
  );
}

async function handleCertificateChange(
  trackedDomainId: string,
  domainName: string,
  userId: string,
  userName: string,
  userEmail: string,
  change: CertificateChange,
  newValidTo: string,
  logger: Logger,
): Promise<boolean> {
  const { shouldSendEmail, shouldSendInApp } =
    await determineNotificationChannels(
      userId,
      trackedDomainId,
      "certificateChanges",
      "certificateChangesInApp",
      "certificateChanges",
      "certificateChangesInApp",
    );

  if (!shouldSendEmail && !shouldSendInApp) return false;

  // Resolve CA provider names without mutating the input
  let previousCaProvider = change.previousCaProvider;
  let newCaProvider = change.newCaProvider;

  if (change.caProviderChanged) {
    const ids = [change.previousCaProviderId, change.newCaProviderId].filter(
      (id): id is string => !!id,
    );
    const names = await getProviderNames(ids);

    if (change.previousCaProviderId) {
      previousCaProvider = names.get(change.previousCaProviderId) ?? null;
    }
    if (change.newCaProviderId) {
      newCaProvider = names.get(change.newCaProviderId) ?? null;
    }
  }

  const idempotencyKey = generateIdempotencyKey(
    trackedDomainId,
    "certificate_change",
    generateChangeHash(change),
  );

  const title = `Certificate changes detected for ${domainName}`;
  const subject = `🔒 ${title}`;
  const changesList = [
    change.issuerChanged && "issuer",
    change.caProviderChanged && "CA provider",
  ]
    .filter(Boolean)
    .join(", ");
  const message = `The SSL certificate for ${domainName} has changed: ${changesList}. Valid until ${newValidTo}.`;

  return await sendNotification(
    {
      userId,
      userEmail,
      trackedDomainId,
      domainName,
      notificationType: "certificate_change",
      title,
      message,
      idempotencyKey,
      emailSubject: subject,
      emailComponent: CertificateChangeEmail({
        userName: userName.split(" ")[0] || "there",
        domainName,
        changes: {
          ...change,
          previousCaProvider,
          newCaProvider,
        },
        newValidTo,
      }),
      logger,
    },
    shouldSendEmail,
    shouldSendInApp,
  );
}

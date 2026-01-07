import "server-only";

import type { Logger } from "inngest";
import { start } from "workflow/api";
import { CertificateChangeEmail } from "@/emails/certificate-change";
import { ProviderChangeEmail } from "@/emails/provider-change";
import { RegistrationChangeEmail } from "@/emails/registration-change";
import {
  detectCertificateChanges,
  detectProviderChanges,
  detectRegistrationChanges,
  generateChangeHash,
} from "@/lib/change-detection";
import { getProviderNames } from "@/lib/db/repos/providers";
import { getSnapshot, updateSnapshot } from "@/lib/db/repos/snapshots";
import { inngest } from "@/lib/inngest/client";
import { INNGEST_EVENTS } from "@/lib/inngest/events";
import { generateIdempotencyKey } from "@/lib/notification-utils";
import {
  determineNotificationChannels,
  sendNotification,
} from "@/lib/notifications";
import type {
  CertificateChange,
  CertificateSnapshotData,
  CertificatesResponse,
  ProviderChange,
  RegistrationChange,
  RegistrationResponse,
  RegistrationSnapshotData,
} from "@/lib/types";
import { fetchHosting } from "@/server/services/hosting";
import { certificatesWorkflow } from "@/workflows/certificates";
import { registrationWorkflow } from "@/workflows/registration";

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

    try {
      // Fetch fresh data for this domain using workflows
      const [registrationData, hostingData, certificatesData] = await step.run(
        "fetch-live-data",
        async () => {
          // Start workflows and fetch hosting in parallel
          const [regRun, hostingPromise, certRun] = await Promise.all([
            start(registrationWorkflow, [{ domain: domainName }]),
            fetchHosting(domainName, { skipScheduling: true }),
            start(certificatesWorkflow, [{ domain: domainName }]),
          ]);

          // Wait for workflow results
          const [regResult, certsResult] = await Promise.all([
            regRun.returnValue,
            certRun.returnValue,
          ]);

          // Extract response data from workflow results
          const registrationData: RegistrationResponse | null =
            regResult.success ? regResult.data : regResult.data; // Error responses still have data
          const certificatesData: CertificatesResponse = certsResult.success
            ? certsResult.data
            : { certificates: [] };

          return [registrationData, hostingPromise, certificatesData] as const;
        },
      );

      const results = {
        registrationChanges: false,
        providerChanges: false,
        certificateChanges: false,
      };

      // Check registration changes
      if (registrationData && registrationData.status === "registered") {
        const currentRegistration = {
          registrarProviderId: registrationData.registrarProvider?.id ?? null,
          nameservers: registrationData.nameservers || [],
          transferLock: registrationData.transferLock ?? null,
          statuses: (registrationData.statuses || []).map((s) =>
            typeof s === "string" ? s : s.status,
          ),
        };

        const registrationChange = detectRegistrationChanges(
          snapshot.registration as RegistrationSnapshotData,
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
      if (certificatesData.certificates.length > 0) {
        const leafCert = certificatesData.certificates[0]; // First cert is the leaf

        const currentCertificate = {
          caProviderId: leafCert.caProvider?.id ?? null,
          issuer: leafCert.issuer,
          validTo: new Date(leafCert.validTo).toISOString(),
          fingerprint: null,
        };

        const certificateChange = detectCertificateChanges(
          snapshot.certificate as CertificateSnapshotData,
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

  // Build descriptive change details
  const changeDetails: string[] = [];

  if (change.registrarChanged) {
    if (previousRegistrar && newRegistrar) {
      changeDetails.push(
        `Registrar changed from ${previousRegistrar} to ${newRegistrar}`,
      );
    } else if (newRegistrar) {
      changeDetails.push(`Registrar set to ${newRegistrar}`);
    } else if (previousRegistrar) {
      changeDetails.push(`Registrar ${previousRegistrar} removed`);
    }
  }

  if (change.transferLockChanged) {
    if (change.newTransferLock === true) {
      changeDetails.push("Transfer lock enabled");
    } else if (change.newTransferLock === false) {
      changeDetails.push("Transfer lock disabled");
    }
  }

  if (change.nameserversChanged) {
    const prevNs = change.previousNameservers.map((ns) => ns.host);
    const newNs = change.newNameservers.map((ns) => ns.host);
    if (prevNs.length > 0 && newNs.length > 0) {
      changeDetails.push(
        `Nameservers changed to ${newNs.slice(0, 2).join(", ")}${newNs.length > 2 ? ` (+${newNs.length - 2} more)` : ""}`,
      );
    } else if (newNs.length > 0) {
      changeDetails.push(
        `Nameservers set to ${newNs.slice(0, 2).join(", ")}${newNs.length > 2 ? ` (+${newNs.length - 2} more)` : ""}`,
      );
    }
  }

  if (change.statusesChanged) {
    const addedStatuses = change.newStatuses.filter(
      (s) => !change.previousStatuses.includes(s),
    );
    const removedStatuses = change.previousStatuses.filter(
      (s) => !change.newStatuses.includes(s),
    );
    if (addedStatuses.length > 0) {
      changeDetails.push(`Status added: ${addedStatuses.join(", ")}`);
    }
    if (removedStatuses.length > 0) {
      changeDetails.push(`Status removed: ${removedStatuses.join(", ")}`);
    }
  }

  // Determine primary change type for title (in priority order)
  let primaryChange = "Registration";
  if (change.registrarChanged) {
    primaryChange = "Registrar";
  } else if (change.transferLockChanged) {
    primaryChange = "Transfer lock";
  } else if (change.nameserversChanged) {
    primaryChange = "Nameservers";
  }

  const title = `${primaryChange} changed for ${domainName}`;
  const subject = `⚠️ ${title}`;
  const message =
    changeDetails.length > 0
      ? `${changeDetails.join(". ")}.`
      : `Registration details updated for ${domainName}.`;

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
    );

  if (!shouldSendEmail && !shouldSendInApp) return false;

  const idempotencyKey = generateIdempotencyKey(
    trackedDomainId,
    "provider_change",
    generateChangeHash(change),
  );

  // Build descriptive change details
  const changeDetails: string[] = [];

  if (change.dnsProviderChanged) {
    const prev = change.previousDnsProvider;
    const next = change.newDnsProvider;
    if (prev && next) {
      changeDetails.push(`DNS provider changed from ${prev} to ${next}`);
    } else if (next) {
      changeDetails.push(`DNS provider set to ${next}`);
    } else if (prev) {
      changeDetails.push(`DNS provider ${prev} removed`);
    }
  }

  if (change.hostingProviderChanged) {
    const prev = change.previousHostingProvider;
    const next = change.newHostingProvider;
    if (prev && next) {
      changeDetails.push(`Hosting changed from ${prev} to ${next}`);
    } else if (next) {
      changeDetails.push(`Hosting set to ${next}`);
    } else if (prev) {
      changeDetails.push(`Hosting provider ${prev} removed`);
    }
  }

  if (change.emailProviderChanged) {
    const prev = change.previousEmailProvider;
    const next = change.newEmailProvider;
    if (prev && next) {
      changeDetails.push(`Email provider changed from ${prev} to ${next}`);
    } else if (next) {
      changeDetails.push(`Email provider set to ${next}`);
    } else if (prev) {
      changeDetails.push(`Email provider ${prev} removed`);
    }
  }

  // Determine primary change type for title (in priority order)
  let primaryChange = "Provider";
  if (change.dnsProviderChanged) {
    primaryChange = "DNS provider";
  } else if (change.hostingProviderChanged) {
    primaryChange = "Hosting";
  } else if (change.emailProviderChanged) {
    primaryChange = "Email provider";
  }

  const title = `${primaryChange} changed for ${domainName}`;
  const subject = `🔄 ${title}`;
  const message =
    changeDetails.length > 0
      ? `${changeDetails.join(". ")}.`
      : `Provider configuration updated for ${domainName}.`;

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

  // Build descriptive change details
  const changeDetails: string[] = [];

  if (change.caProviderChanged) {
    const prev = previousCaProvider;
    const next = newCaProvider;
    if (prev && next) {
      changeDetails.push(
        `Certificate authority changed from ${prev} to ${next}`,
      );
    } else if (next) {
      changeDetails.push(`Certificate authority set to ${next}`);
    }
  }

  if (change.issuerChanged) {
    const prev = change.previousIssuer;
    const next = change.newIssuer;
    if (prev && next) {
      changeDetails.push(`Issuer changed from ${prev} to ${next}`);
    } else if (next) {
      changeDetails.push(`Issuer set to ${next}`);
    }
  }

  // Add validity info
  changeDetails.push(`Valid until ${newValidTo}`);

  // Determine primary change type for title
  const primaryChange = change.caProviderChanged
    ? "Certificate authority"
    : "Certificate";

  const title = `${primaryChange} changed for ${domainName}`;
  const subject = `🔒 ${title}`;
  const message = `${changeDetails.join(". ")}.`;

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

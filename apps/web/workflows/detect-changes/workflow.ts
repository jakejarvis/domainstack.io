import {
  fetchCertificateChainStep,
  persistCertificatesStep,
  processChainStep,
} from "@/workflows/shared/certificates";
import { fetchDnsRecordsStep, persistDnsRecordsStep } from "@/workflows/shared/dns";
import { fetchHeadersStep, persistHeadersStep } from "@/workflows/shared/headers";
import {
  detectAndResolveProvidersStep,
  lookupGeoIpStep,
  persistHostingStep,
} from "@/workflows/shared/hosting";
import {
  determineNotificationChannelsStep,
  resolveProviderNamesStep,
  sendCertificateChangeNotificationStep,
  sendProviderChangeNotificationStep,
  sendRegistrationChangeNotificationStep,
} from "@/workflows/shared/notifications";
import {
  lookupWhoisStep,
  normalizeAndBuildResponseStep,
  persistRegistrationStep,
} from "@/workflows/shared/registration";
import { optionalCall, optionalSettled, requireSettled } from "@/workflows/shared/settled";
import type {
  CertificateSnapshotData,
  CertificatesResponse,
  HostingResponse,
  RegistrationResponse,
  RegistrationSnapshotData,
} from "@domainstack/types";
import {
  type CertificateChangeWithNames,
  detectProviderChange,
  detectRegistrationChange,
  evaluateCertificateChange,
  type ProviderChangeWithNames,
} from "@domainstack/utils/change-detection";

// =============================================================================
// Workflow Types
// =============================================================================

export interface DetectChangesWorkflowInput {
  trackedDomainId: string;
}

export interface DetectChangesWorkflowResult {
  skipped?: boolean;
  reason?: string;
  registrationChanges: boolean;
  providerChanges: boolean;
  certificateChanges: boolean;
}

/**
 * Durable workflow to detect changes in a tracked domain.
 *
 * Fetches fresh data and compares against the stored baseline snapshot to detect
 * registration, provider, and certificate changes, sending notifications
 * when changes are detected.
 */
export async function detectChangesWorkflow(
  input: DetectChangesWorkflowInput,
): Promise<DetectChangesWorkflowResult> {
  "use workflow";

  const { trackedDomainId } = input;

  // Step 1: Fetch snapshot data
  const snapshot = await fetchSnapshot(trackedDomainId);

  if (!snapshot) {
    return {
      skipped: true,
      reason: "snapshot_not_found",
      registrationChanges: false,
      providerChanges: false,
      certificateChanges: false,
    };
  }

  const { domainName, userId, userName, userEmail } = snapshot;

  // Step 2: Fetch fresh data. Headers/certs are enrichment — a domain with no
  // A/AAAA (or an unreachable host) must still be monitored.
  const [registrationSettled, dnsSettled, headersSettled, certificatesSettled] =
    await Promise.allSettled([
      lookupWhoisStep(domainName),
      fetchDnsRecordsStep(domainName),
      fetchHeadersStep(domainName),
      fetchCertificateChainStep(domainName),
    ]);

  // WHOIS/headers/certs are enrichment. RDAP timeouts and unreachable
  // HTTP/TLS hosts must not prevent monitoring. DNS is required.
  const registrationResult = optionalSettled(registrationSettled);
  const dnsResult = requireSettled(dnsSettled);
  const headersResult = optionalSettled(headersSettled);
  const certificatesResult = optionalSettled(certificatesSettled);

  // Process and persist registration
  let registrationData: RegistrationResponse | null = null;
  if (registrationResult?.success) {
    registrationData = await normalizeAndBuildResponseStep(registrationResult.data.recordJson);
    if (registrationData.isRegistered) {
      await optionalCall(persistRegistrationStep(domainName, registrationData));
    }
  }

  // Persist DNS (always succeeds or throws)
  await persistDnsRecordsStep(domainName, dnsResult.data);

  if (headersResult?.success) {
    await optionalCall(persistHeadersStep(domainName, headersResult.data));
  }

  // Process and persist certificates
  let certificatesData: CertificatesResponse | null = null;
  if (certificatesResult?.success) {
    const processed = await optionalCall(processChainStep(certificatesResult.data.chainJson));
    if (processed) {
      await optionalCall(persistCertificatesStep(domainName, processed));
      certificatesData = { certificates: processed.certificates };
    }
  }

  // Hosting detection uses DNS even when headers fail (no A/AAAA, etc.)
  const a = dnsResult.data.records.find((d) => d.type === "A");
  const aaaa = dnsResult.data.records.find((d) => d.type === "AAAA");
  const ip = (a?.value || aaaa?.value) ?? null;
  const geoResult = ip ? await optionalCall(lookupGeoIpStep(ip)) : null;
  const headers = headersResult?.success ? headersResult.data.headers : [];

  const providers = await detectAndResolveProvidersStep(dnsResult.data.records, headers, geoResult);

  await optionalCall(persistHostingStep(domainName, providers, geoResult?.geo ?? null));

  const hostingData: HostingResponse = {
    hostingProvider: providers.hostingProvider,
    emailProvider: providers.emailProvider,
    dnsProvider: providers.dnsProvider,
    geo: geoResult?.geo ?? null,
  };

  const results = {
    registrationChanges: false,
    providerChanges: false,
    certificateChanges: false,
  };

  // Step 3: Check registration changes
  if (registrationData && registrationData.status === "registered") {
    const currentRegistration = {
      registrarProviderId: registrationData.registrarProvider?.id ?? null,
      nameservers: registrationData.nameservers || [],
      transferLock: registrationData.transferLock ?? null,
      statuses: (registrationData.statuses || []).map((s: string | { status: string }) =>
        typeof s === "string" ? s : s.status,
      ),
    };

    const registrationChange = detectRegistrationChange(snapshot.registration, currentRegistration);

    if (registrationChange) {
      // Step 3a: Check notification preferences
      const channels = await determineNotificationChannelsStep(
        userId,
        trackedDomainId,
        "registrationChanges",
      );

      if (channels.shouldSendEmail || channels.shouldSendInApp) {
        // Step 3b: Resolve registrar provider names
        const registrarIds = [
          registrationChange.previousRegistrar,
          registrationChange.newRegistrar,
        ].filter((id): id is string => !!id);
        const registrarNames =
          registrarIds.length > 0 ? await resolveProviderNamesStep(registrarIds) : new Map();

        const previousRegistrar = registrationChange.previousRegistrar
          ? (registrarNames.get(registrationChange.previousRegistrar) ??
            registrationChange.previousRegistrar)
          : null;
        const newRegistrar = registrationChange.newRegistrar
          ? (registrarNames.get(registrationChange.newRegistrar) ?? registrationChange.newRegistrar)
          : null;

        // Build notification content (title, message, subject) - inlined
        const changeDetails: string[] = [];

        if (registrationChange.registrarChanged) {
          if (previousRegistrar && newRegistrar) {
            changeDetails.push(`Registrar changed from ${previousRegistrar} to ${newRegistrar}`);
          } else if (newRegistrar) {
            changeDetails.push(`Registrar set to ${newRegistrar}`);
          } else if (previousRegistrar) {
            changeDetails.push(`Registrar ${previousRegistrar} removed`);
          }
        }

        if (registrationChange.transferLockChanged) {
          if (registrationChange.newTransferLock === true) {
            changeDetails.push("Transfer lock enabled");
          } else if (registrationChange.newTransferLock === false) {
            changeDetails.push("Transfer lock disabled");
          }
        }

        if (registrationChange.nameserversChanged) {
          const prevNs = registrationChange.previousNameservers.map((ns) => ns.host);
          const newNs = registrationChange.newNameservers.map((ns) => ns.host);
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

        if (registrationChange.statusesChanged) {
          const addedStatuses = registrationChange.newStatuses.filter(
            (s) => !registrationChange.previousStatuses.includes(s),
          );
          const removedStatuses = registrationChange.previousStatuses.filter(
            (s) => !registrationChange.newStatuses.includes(s),
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
        if (registrationChange.registrarChanged) {
          primaryChange = "Registrar";
        } else if (registrationChange.transferLockChanged) {
          primaryChange = "Transfer lock";
        } else if (registrationChange.nameserversChanged) {
          primaryChange = "Nameservers";
        }

        const title = `${primaryChange} changed for ${domainName}`;
        const emailSubject = `⚠️ ${title}`;
        const message =
          changeDetails.length > 0
            ? `${changeDetails.join(". ")}.`
            : `Registration details updated for ${domainName}.`;

        // Step 3c: Send notification (imports email component in step)
        const sent = await sendRegistrationChangeNotificationStep(
          {
            userId,
            userEmail,
            trackedDomainId,
            domainName,
            userName,
            title,
            message,
            emailSubject,
            changes: {
              registrarChanged: registrationChange.registrarChanged,
              nameserversChanged: registrationChange.nameserversChanged,
              transferLockChanged: registrationChange.transferLockChanged,
              statusesChanged: registrationChange.statusesChanged,
              previousRegistrar: previousRegistrar || undefined,
              newRegistrar: newRegistrar || undefined,
              previousNameservers: registrationChange.previousNameservers,
              newNameservers: registrationChange.newNameservers,
              previousTransferLock: registrationChange.previousTransferLock ?? undefined,
              newTransferLock: registrationChange.newTransferLock ?? undefined,
              previousStatuses: registrationChange.previousStatuses,
              newStatuses: registrationChange.newStatuses,
            },
          },
          channels.shouldSendEmail,
          channels.shouldSendInApp,
        );

        if (sent) {
          results.registrationChanges = true;
          await updateRegistrationSnapshot(trackedDomainId, currentRegistration);
        }
      }
    }
  }

  // Step 4: Check provider changes
  if (hostingData) {
    const currentProviderIds = {
      dns: hostingData.dnsProvider?.id ?? null,
      hosting: hostingData.hostingProvider?.id ?? null,
      email: hostingData.emailProvider?.id ?? null,
    };

    const providerChange = detectProviderChange(
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
      // Step 4a: Check notification preferences
      const channels = await determineNotificationChannelsStep(
        userId,
        trackedDomainId,
        "providerChanges",
      );

      if (channels.shouldSendEmail || channels.shouldSendInApp) {
        // Step 4b: Fetch provider names for notification
        const providerIds = [
          snapshot.dnsProviderId,
          snapshot.hostingProviderId,
          snapshot.emailProviderId,
          currentProviderIds.dns,
          currentProviderIds.hosting,
          currentProviderIds.email,
        ].filter((id): id is string => id !== null);

        const providerNames = await resolveProviderNamesStep(providerIds);

        const enrichedChange: ProviderChangeWithNames = {
          ...providerChange,
          previousDnsProvider: providerChange.previousDnsProviderId
            ? providerNames.get(providerChange.previousDnsProviderId) || null
            : null,
          newDnsProvider: providerChange.newDnsProviderId
            ? providerNames.get(providerChange.newDnsProviderId) || null
            : null,
          previousHostingProvider: providerChange.previousHostingProviderId
            ? providerNames.get(providerChange.previousHostingProviderId) || null
            : null,
          newHostingProvider: providerChange.newHostingProviderId
            ? providerNames.get(providerChange.newHostingProviderId) || null
            : null,
          previousEmailProvider: providerChange.previousEmailProviderId
            ? providerNames.get(providerChange.previousEmailProviderId) || null
            : null,
          newEmailProvider: providerChange.newEmailProviderId
            ? providerNames.get(providerChange.newEmailProviderId) || null
            : null,
        };

        // Step 4c: Build notification content - inlined
        const providerChangeDetails: string[] = [];

        if (enrichedChange.dnsProviderChanged) {
          const prev = enrichedChange.previousDnsProvider;
          const next = enrichedChange.newDnsProvider;
          if (prev && next) {
            providerChangeDetails.push(`DNS provider changed from ${prev} to ${next}`);
          } else if (next) {
            providerChangeDetails.push(`DNS provider set to ${next}`);
          } else if (prev) {
            providerChangeDetails.push(`DNS provider ${prev} removed`);
          }
        }

        if (enrichedChange.hostingProviderChanged) {
          const prev = enrichedChange.previousHostingProvider;
          const next = enrichedChange.newHostingProvider;
          if (prev && next) {
            providerChangeDetails.push(`Hosting changed from ${prev} to ${next}`);
          } else if (next) {
            providerChangeDetails.push(`Hosting set to ${next}`);
          } else if (prev) {
            providerChangeDetails.push(`Hosting provider ${prev} removed`);
          }
        }

        if (enrichedChange.emailProviderChanged) {
          const prev = enrichedChange.previousEmailProvider;
          const next = enrichedChange.newEmailProvider;
          if (prev && next) {
            providerChangeDetails.push(`Email provider changed from ${prev} to ${next}`);
          } else if (next) {
            providerChangeDetails.push(`Email provider set to ${next}`);
          } else if (prev) {
            providerChangeDetails.push(`Email provider ${prev} removed`);
          }
        }

        // Determine primary change type for title (in priority order)
        let providerPrimaryChange = "Provider";
        if (enrichedChange.dnsProviderChanged) {
          providerPrimaryChange = "DNS provider";
        } else if (enrichedChange.hostingProviderChanged) {
          providerPrimaryChange = "Hosting";
        } else if (enrichedChange.emailProviderChanged) {
          providerPrimaryChange = "Email provider";
        }

        const title = `${providerPrimaryChange} changed for ${domainName}`;
        const emailSubject = `🔄 ${title}`;
        const message =
          providerChangeDetails.length > 0
            ? `${providerChangeDetails.join(". ")}.`
            : `Provider configuration updated for ${domainName}.`;

        const sent = await sendProviderChangeNotificationStep(
          {
            userId,
            userEmail,
            trackedDomainId,
            domainName,
            userName,
            title,
            message,
            emailSubject,
            changes: enrichedChange,
          },
          channels.shouldSendEmail,
          channels.shouldSendInApp,
        );

        if (sent) {
          results.providerChanges = true;
          await updateProviderSnapshot(trackedDomainId, currentProviderIds);
        }
      }
    }
  }

  // Step 5: Check certificate changes
  if (certificatesData && certificatesData.certificates.length > 0) {
    const [leafCert] = certificatesData.certificates;

    const currentCertificate: CertificateSnapshotData = {
      caProviderId: leafCert.caProvider?.id ?? null,
      issuer: leafCert.issuer,
      validTo: new Date(leafCert.validTo).toISOString(),
      fingerprint: leafCert.fingerprint256,
      serialNumber: leafCert.serialNumber,
    };

    const evaluation = evaluateCertificateChange(snapshot.certificate, currentCertificate);

    const persistCertificateSnapshot = async () => {
      if (evaluation.snapshotToWrite) {
        await updateCertificateSnapshot(trackedDomainId, evaluation.snapshotToWrite);
      }
    };

    if (evaluation.shouldNotify) {
      const channels = await determineNotificationChannelsStep(
        userId,
        trackedDomainId,
        "certificateChanges",
      );

      if (channels.shouldSendEmail || channels.shouldSendInApp) {
        const certificateChange = evaluation.change;
        const caIds = [
          certificateChange.previousCaProviderId,
          certificateChange.newCaProviderId,
        ].filter((id): id is string => id !== null);

        const caProviderNames = await resolveProviderNamesStep(caIds);

        const enrichedChange: CertificateChangeWithNames = {
          ...certificateChange,
          previousCaProvider: certificateChange.previousCaProviderId
            ? caProviderNames.get(certificateChange.previousCaProviderId) || null
            : null,
          newCaProvider: certificateChange.newCaProviderId
            ? caProviderNames.get(certificateChange.newCaProviderId) || null
            : null,
        };

        const validUntil = formatCertificateValidUntil(currentCertificate.validTo);
        const certChangeDetails: string[] = [];

        if (evaluation.kind === "renewal") {
          certChangeDetails.push(`Valid until ${validUntil}`);
        } else {
          if (enrichedChange.caProviderChanged) {
            const prev = enrichedChange.previousCaProvider;
            const next = enrichedChange.newCaProvider;
            if (prev && next) {
              certChangeDetails.push(`Certificate authority changed from ${prev} to ${next}`);
            } else if (next) {
              certChangeDetails.push(`Certificate authority set to ${next}`);
            }
          }

          if (enrichedChange.issuerChanged) {
            const prev = enrichedChange.previousIssuer;
            const next = enrichedChange.newIssuer;
            if (prev && next) {
              certChangeDetails.push(`Issuer changed from ${prev} to ${next}`);
            } else if (next) {
              certChangeDetails.push(`Issuer set to ${next}`);
            }
          }

          certChangeDetails.push(`Valid until ${validUntil}`);
        }

        const title =
          evaluation.kind === "renewal"
            ? `Certificate renewed for ${domainName}`
            : evaluation.kind === "authority"
              ? `Certificate authority changed for ${domainName}`
              : `Certificate changed for ${domainName}`;
        const emailSubject = `🔒 ${title}`;
        const message = `${certChangeDetails.join(". ")}.`;

        let sent = false;
        try {
          sent = await sendCertificateChangeNotificationStep(
            {
              userId,
              userEmail,
              trackedDomainId,
              domainName,
              userName,
              title,
              message,
              emailSubject,
              newValidTo: currentCertificate.validTo,
              kind: evaluation.kind,
              changes: enrichedChange,
            },
            channels.shouldSendEmail,
            channels.shouldSendInApp,
          );
        } finally {
          await persistCertificateSnapshot();
        }

        if (sent) {
          results.certificateChanges = true;
        }
      } else {
        await persistCertificateSnapshot();
      }
    } else {
      await persistCertificateSnapshot();
    }
  }

  return results;
}

function formatCertificateValidUntil(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return new Intl.DateTimeFormat("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
    timeZone: "UTC",
  }).format(date);
}

// --- Step Functions ---

// Import SnapshotForMonitoring type for proper typing
type SnapshotData = Awaited<ReturnType<typeof import("@domainstack/db/queries").getSnapshot>>;

async function fetchSnapshot(trackedDomainId: string): Promise<SnapshotData> {
  "use step";

  const { getSnapshot } = await import("@domainstack/db/queries");
  return await getSnapshot(trackedDomainId);
}

async function updateRegistrationSnapshot(
  trackedDomainId: string,
  registration: RegistrationSnapshotData,
): Promise<void> {
  "use step";

  const { updateSnapshot } = await import("@domainstack/db/queries");
  await updateSnapshot(trackedDomainId, { registration });
}

async function updateProviderSnapshot(
  trackedDomainId: string,
  providers: {
    dns: string | null;
    hosting: string | null;
    email: string | null;
  },
): Promise<void> {
  "use step";

  const { updateSnapshot } = await import("@domainstack/db/queries");
  await updateSnapshot(trackedDomainId, {
    dnsProviderId: providers.dns,
    hostingProviderId: providers.hosting,
    emailProviderId: providers.email,
  });
}

async function updateCertificateSnapshot(
  trackedDomainId: string,
  certificate: CertificateSnapshotData,
): Promise<void> {
  "use step";

  const { updateSnapshot } = await import("@domainstack/db/queries");
  await updateSnapshot(trackedDomainId, { certificate });
}

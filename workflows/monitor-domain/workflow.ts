import { start } from "workflow/api";
import type {
  CertificateChange,
  CertificateSnapshotData,
  CertificatesResponse,
  HostingChange,
  HostingResponse,
  RegistrationChange,
  RegistrationResponse,
  RegistrationSnapshotData,
} from "@/lib/types";
import { certificatesWorkflow } from "@/workflows/certificates";
import { dnsWorkflow } from "@/workflows/dns";
import { headersWorkflow } from "@/workflows/headers";
import { hostingWorkflow } from "@/workflows/hosting";
import { registrationWorkflow } from "@/workflows/registration";

export interface MonitorDomainWorkflowInput {
  trackedDomainId: string;
}

export interface MonitorDomainWorkflowResult {
  skipped?: boolean;
  reason?: string;
  registrationChanges: boolean;
  providerChanges: boolean;
  certificateChanges: boolean;
}

/**
 * Durable workflow to monitor a tracked domain for changes.
 *
 * Fetches fresh data and compares against the stored snapshot to detect
 * registration, provider, and certificate changes, sending notifications
 * when changes are detected.
 */
export async function monitorDomainWorkflow(
  input: MonitorDomainWorkflowInput,
): Promise<MonitorDomainWorkflowResult> {
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

  // Step 2: Fetch fresh data for this domain using workflows
  const [registrationData, hostingData, certificatesData] =
    await fetchLiveData(domainName);

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
      statuses: (registrationData.statuses || []).map((s) =>
        typeof s === "string" ? s : s.status,
      ),
    };

    const registrationChange = await detectRegistrationChange(
      snapshot.registration as RegistrationSnapshotData,
      currentRegistration,
    );

    if (registrationChange) {
      const sent = await handleRegistrationChange(
        trackedDomainId,
        domainName,
        userId,
        userName,
        userEmail,
        registrationChange,
      );

      if (sent) {
        results.registrationChanges = true;
        await updateRegistrationSnapshot(trackedDomainId, currentRegistration);
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

    const providerChange = await detectProviderChange(
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

      const providerNames = await fetchProviderNames(providerIds);

      const enrichedChange: HostingChange = {
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

      const sent = await handleProviderChange(
        trackedDomainId,
        domainName,
        userId,
        userName,
        userEmail,
        enrichedChange,
      );

      if (sent) {
        results.providerChanges = true;
        await updateProviderSnapshot(trackedDomainId, currentProviderIds);
      }
    }
  }

  // Step 5: Check certificate changes
  if (certificatesData.certificates.length > 0) {
    const leafCert = certificatesData.certificates[0];

    const currentCertificate = {
      caProviderId: leafCert.caProvider?.id ?? null,
      issuer: leafCert.issuer,
      validTo: new Date(leafCert.validTo).toISOString(),
      fingerprint: null,
    };

    const certificateChange = await detectCertificateChange(
      snapshot.certificate as CertificateSnapshotData,
      currentCertificate,
    );

    if (certificateChange) {
      const caIds = [
        certificateChange.previousCaProviderId,
        certificateChange.newCaProviderId,
      ].filter((id): id is string => id !== null);

      const caProviderNames = await fetchProviderNames(caIds);

      const enrichedChange: CertificateChange = {
        ...certificateChange,
        previousCaProvider: certificateChange.previousCaProviderId
          ? caProviderNames[certificateChange.previousCaProviderId] || null
          : null,
        newCaProvider: certificateChange.newCaProviderId
          ? caProviderNames[certificateChange.newCaProviderId] || null
          : null,
      };

      const sent = await handleCertificateChange(
        trackedDomainId,
        domainName,
        userId,
        userName,
        userEmail,
        enrichedChange,
        currentCertificate.validTo,
      );

      if (sent) {
        results.certificateChanges = true;
        await updateCertificateSnapshot(trackedDomainId, currentCertificate);
      }
    }
  }

  return results;
}

// --- Step Functions ---

interface SnapshotData {
  domainName: string;
  userId: string;
  userName: string;
  userEmail: string;
  registration: unknown;
  certificate: unknown;
  dnsProviderId: string | null;
  hostingProviderId: string | null;
  emailProviderId: string | null;
}

async function fetchSnapshot(
  trackedDomainId: string,
): Promise<SnapshotData | null> {
  "use step";

  const { getSnapshot } = await import("@/lib/db/repos/snapshots");
  return await getSnapshot(trackedDomainId);
}

async function fetchLiveData(
  domainName: string,
): Promise<
  [RegistrationResponse | null, HostingResponse | null, CertificatesResponse]
> {
  "use step";

  // Start all independent workflows in parallel
  const [regRun, dnsRun, headersRun, certRun] = await Promise.all([
    start(registrationWorkflow, [{ domain: domainName }]),
    start(dnsWorkflow, [{ domain: domainName }]),
    start(headersWorkflow, [{ domain: domainName }]),
    start(certificatesWorkflow, [{ domain: domainName }]),
  ]);

  // Wait for all workflow results
  const [regResult, dnsResult, headersResult, certsResult] = await Promise.all([
    regRun.returnValue,
    dnsRun.returnValue,
    headersRun.returnValue,
    certRun.returnValue,
  ]);

  // Now compute hosting using the DNS + headers data (no duplicate fetches)
  const hostingRun = await start(hostingWorkflow, [
    {
      domain: domainName,
      dnsRecords: dnsResult.data.records,
      headers: headersResult.data.headers,
    },
  ]);
  const hostingResult = await hostingRun.returnValue;

  // Extract response data from workflow results
  const registrationData: RegistrationResponse | null = regResult.success
    ? regResult.data
    : regResult.data;
  const certificatesData: CertificatesResponse = certsResult.success
    ? certsResult.data
    : { certificates: [] };
  const hostingData: HostingResponse | null = hostingResult.data;

  return [registrationData, hostingData, certificatesData];
}

async function detectRegistrationChange(
  previous: RegistrationSnapshotData,
  current: RegistrationSnapshotData,
): Promise<RegistrationChange | null> {
  "use step";

  const { detectRegistrationChanges } = await import("@/lib/change-detection");
  return detectRegistrationChanges(previous, current);
}

async function detectProviderChange(
  previous: {
    dnsProviderId: string | null;
    hostingProviderId: string | null;
    emailProviderId: string | null;
  },
  current: {
    dnsProviderId: string | null;
    hostingProviderId: string | null;
    emailProviderId: string | null;
  },
): Promise<Omit<
  HostingChange,
  | "previousDnsProvider"
  | "newDnsProvider"
  | "previousHostingProvider"
  | "newHostingProvider"
  | "previousEmailProvider"
  | "newEmailProvider"
> | null> {
  "use step";

  const { detectProviderChanges } = await import("@/lib/change-detection");
  return detectProviderChanges(previous, current);
}

async function detectCertificateChange(
  previous: CertificateSnapshotData,
  current: CertificateSnapshotData,
): Promise<CertificateChange | null> {
  "use step";

  const { detectCertificateChanges } = await import("@/lib/change-detection");
  return detectCertificateChanges(previous, current);
}

async function fetchProviderNames(
  providerIds: string[],
): Promise<Record<string, string>> {
  "use step";

  if (providerIds.length === 0) return {};

  const { getProviderNames } = await import("@/lib/db/repos/providers");
  const names = await getProviderNames(providerIds);
  return Object.fromEntries(names);
}

async function updateRegistrationSnapshot(
  trackedDomainId: string,
  registration: RegistrationSnapshotData,
): Promise<void> {
  "use step";

  const { updateSnapshot } = await import("@/lib/db/repos/snapshots");
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

  const { updateSnapshot } = await import("@/lib/db/repos/snapshots");
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

  const { updateSnapshot } = await import("@/lib/db/repos/snapshots");
  await updateSnapshot(trackedDomainId, { certificate });
}

async function handleRegistrationChange(
  trackedDomainId: string,
  domainName: string,
  userId: string,
  userName: string,
  userEmail: string,
  change: RegistrationChange,
): Promise<boolean> {
  "use step";

  const { RegistrationChangeEmail } = await import(
    "@/emails/registration-change"
  );
  const { generateChangeHash } = await import("@/lib/change-detection");
  const { getProviderNames } = await import("@/lib/db/repos/providers");
  const { generateIdempotencyKey } = await import("@/lib/notification-utils");
  const { determineNotificationChannels, sendNotification } = await import(
    "@/lib/notifications"
  );
  const { createLogger } = await import("@/lib/logger/server");

  const logger = createLogger({ source: "monitor-domain-workflow" });

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
  change: HostingChange,
): Promise<boolean> {
  "use step";

  const { ProviderChangeEmail } = await import("@/emails/provider-change");
  const { generateChangeHash } = await import("@/lib/change-detection");
  const { generateIdempotencyKey } = await import("@/lib/notification-utils");
  const { determineNotificationChannels, sendNotification } = await import(
    "@/lib/notifications"
  );
  const { createLogger } = await import("@/lib/logger/server");

  const logger = createLogger({ source: "monitor-domain-workflow" });

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
): Promise<boolean> {
  "use step";

  const { CertificateChangeEmail } = await import(
    "@/emails/certificate-change"
  );
  const { generateChangeHash } = await import("@/lib/change-detection");
  const { getProviderNames } = await import("@/lib/db/repos/providers");
  const { generateIdempotencyKey } = await import("@/lib/notification-utils");
  const { determineNotificationChannels, sendNotification } = await import(
    "@/lib/notifications"
  );
  const { createLogger } = await import("@/lib/logger/server");

  const logger = createLogger({ source: "monitor-domain-workflow" });

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

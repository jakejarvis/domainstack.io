import { FatalError } from "workflow";

import type { SnapshotForMonitoring } from "@domainstack/db/queries/snapshots";
import type {
  CertificateChangeWithNames,
  CertificateSnapshotData,
  PendingChangeObservation,
  ProviderChangeWithNames,
  RegistrationSnapshotData,
} from "@domainstack/types";
import { findLeafCertificate } from "@domainstack/utils/tls";

import {
  certificateSnapshotFrom,
  confirmChange,
  detectProviderChange,
  detectRegistrationChange,
  evaluateCertificateChange,
  isUninitializedRegistration,
  providerObservationKey,
  registrationObservationKey,
  registrationSnapshotFrom,
} from "../lib/change-detection/detection";
import {
  describeCertificateChange,
  describeProviderChange,
  describeRegistrationChange,
  describeUnregistered,
} from "../lib/change-detection/notification-copy";
import {
  determineNotificationChannelsStep,
  type NotificationChannels,
  resolveProviderNamesStep,
  sendChangeNotificationStep,
} from "../steps/notifications";
import { observeDomain } from "../steps/observe-domain";

// =============================================================================
// Workflow Types
// =============================================================================

interface DetectChangesWorkflowInput {
  trackedDomainId: string;
  monitorLockOwnerToken: string;
}

type DetectChangesWorkflowResult =
  | {
      skipped: true;
      reason: "snapshot_not_found";
      registrationChanges: false;
      providerChanges: false;
      certificateChanges: false;
    }
  | {
      skipped: false;
      registrationChanges: boolean;
      providerChanges: boolean;
      certificateChanges: boolean;
    };

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

  const { trackedDomainId, monitorLockOwnerToken } = input;

  try {
    // Step 1: Fetch snapshot data
    const snapshot = await fetchSnapshot(trackedDomainId);

    if (!snapshot) {
      await releaseMonitorLockStep(trackedDomainId, monitorLockOwnerToken);
      return {
        skipped: true,
        reason: "snapshot_not_found",
        registrationChanges: false,
        providerChanges: false,
        certificateChanges: false,
      };
    }

    return await runChangeDetection(trackedDomainId, monitorLockOwnerToken, snapshot);
  } catch (err) {
    // A FatalError means nothing will retry this run, so the lock must be
    // released now or it blocks the cron for the full 90-minute TTL. A plain
    // Error/RetryableError leaves it held: the SDK retries this same run.
    // FatalError.is, not instanceof: this error crossed the step/workflow
    // boundary and may be rehydrated without its original prototype.
    if (FatalError.is(err)) {
      await releaseMonitorLockStep(trackedDomainId, monitorLockOwnerToken);
    }
    throw err;
  }
}

/** What every change check needs about the tracked domain and its baseline. */
interface CheckContext {
  trackedDomainId: string;
  snapshot: SnapshotForMonitoring;
}

async function runChangeDetection(
  trackedDomainId: string,
  monitorLockOwnerToken: string,
  snapshot: SnapshotForMonitoring,
): Promise<DetectChangesWorkflowResult> {
  // Step 2: Fetch and persist fresh data
  const observation = await observeDomain(snapshot.domainName);
  const ctx: CheckContext = { trackedDomainId, snapshot };

  // Each check advances its own part of the snapshot. They run in sequence so
  // the step order (and so each replay) stays the same.
  const registrationChanges = await checkRegistration(ctx, observation.registrationData);
  const providerChanges = await checkProviders(ctx, observation);
  const certificateChanges = await checkCertificate(ctx, observation.certificates);

  // Release the per-domain monitor lock so the next hourly cron can re-run.
  // Only runs on successful completion — a retrying Error/RetryableError above
  // propagates to the caller's catch, which leaves the lock held (TTL safety
  // net) so the cron doesn't start a duplicate; a terminal FatalError is
  // released there too, since nothing is going to retry it.
  await releaseMonitorLockStep(trackedDomainId, monitorLockOwnerToken);

  return { skipped: false, registrationChanges, providerChanges, certificateChanges };
}

type Observation = Awaited<ReturnType<typeof observeDomain>>;

const hasAnyChannel = (channels: NotificationChannels) =>
  channels.shouldSendEmail || channels.shouldSendInApp;

/** A resolved provider name, or null when the id is absent or unknown. */
const nameOf = (names: Map<string, string>, id: string | null) =>
  id ? names.get(id) || null : null;

function recipientOf({ snapshot, trackedDomainId }: CheckContext) {
  return {
    userId: snapshot.userId,
    userEmail: snapshot.userEmail,
    userName: snapshot.userName,
    domainName: snapshot.domainName,
    trackedDomainId,
  };
}

/** Step 3: registrar, nameserver, transfer lock, and status changes, plus a lapsed registration. */
async function checkRegistration(
  ctx: CheckContext,
  registrationData: Observation["registrationData"],
): Promise<boolean> {
  const { trackedDomainId, snapshot } = ctx;
  const stored = snapshot.registration;

  if (registrationData?.status === "unregistered") {
    return await checkUnregistered(ctx);
  }
  if (registrationData?.status !== "registered") {
    return false;
  }

  const currentRegistration = registrationSnapshotFrom(registrationData);

  if (isUninitializedRegistration(stored)) {
    // The baseline was written without registration data (lookup unavailable
    // at initialize time). Adopt this first real observation silently —
    // reporting "nothing → registrar X" would be a false alert.
    await updateRegistrationSnapshot(trackedDomainId, { ...currentRegistration, pending: null });
    return false;
  }

  const registrationChange = detectRegistrationChange(stored, currentRegistration);

  if (!registrationChange) {
    // No difference from the stored snapshot: clear a stale pending
    // observation if one is set (the wobble went away), or a stale
    // "unregistered" flag if the domain came back with the same data.
    if (stored.pending || stored.unregistered) {
      await updateRegistrationSnapshot(trackedDomainId, {
        ...stored,
        pending: null,
        unregistered: false,
      });
    }
    return false;
  }

  const channels = await determineNotificationChannelsStep(
    snapshot.userId,
    trackedDomainId,
    "registrationChanges",
  );

  if (!hasAnyChannel(channels)) {
    // Muted domain / disabled category: nothing to deliver. Advance the
    // snapshot now so we don't infinitely re-detect this change (and
    // don't replay a stale change as "fresh" when the user later unmutes
    // / re-enables the category).
    await updateRegistrationSnapshot(trackedDomainId, { ...currentRegistration, pending: null });
    return false;
  }

  // Require a repeat observation before notifying — a single differing
  // lookup is often a transient wobble (see confirmChange).
  const confirmation = confirmChange(
    stored.pending,
    registrationObservationKey(currentRegistration),
  );

  if (!confirmation.confirmed) {
    // Keep the previous registration values — only pending changes.
    await updateRegistrationSnapshot(trackedDomainId, {
      ...stored,
      pending: confirmation.pending,
    });
    return false;
  }

  // Unknown registrar ids fall back to the id itself rather than "removed".
  const registrarIds = [
    registrationChange.previousRegistrar,
    registrationChange.newRegistrar,
  ].filter((id): id is string => !!id);
  const registrarNames =
    registrarIds.length > 0
      ? await resolveProviderNamesStep(registrarIds)
      : new Map<string, string>();
  const changes = {
    ...registrationChange,
    previousRegistrar: registrationChange.previousRegistrar
      ? (registrarNames.get(registrationChange.previousRegistrar) ??
        registrationChange.previousRegistrar)
      : null,
    newRegistrar: registrationChange.newRegistrar
      ? (registrarNames.get(registrationChange.newRegistrar) ?? registrationChange.newRegistrar)
      : null,
  };

  // Settle notification delivery. A permanent email failure can degrade to
  // in-app-only (or no delivery when email was the only channel), but the
  // snapshot still advances so the workflow does not retry an address that
  // cannot accept mail forever.
  // Keyed by the change (before > after), not the step: if this run fails
  // after sending, the next hourly run re-detects the same change and
  // Resend dedupes the email instead of delivering it twice.
  await sendChangeNotificationStep(
    {
      ...recipientOf(ctx),
      ...describeRegistrationChange(changes, snapshot.domainName),
      type: "registration_change",
      changes,
      idempotencyKey: `registration:${trackedDomainId}:${registrationObservationKey(stored)}>${registrationObservationKey(currentRegistration)}`,
    },
    channels,
  );

  // Advance only after the email/in-app step succeeds. If a step above
  // threw, the snapshot stays stale and the next hourly cron retries
  // the full alert rather than silently swallowing it.
  await updateRegistrationSnapshot(trackedDomainId, { ...currentRegistration, pending: null });
  return true;
}

/**
 * The registry says a domain we had registration data for is gone. Keep the
 * previous registration values in the snapshot (so a re-registration with a
 * different registrar still alerts) and mark the drop as handled.
 */
async function checkUnregistered(ctx: CheckContext): Promise<boolean> {
  const { trackedDomainId, snapshot } = ctx;
  const stored = snapshot.registration;

  if (isUninitializedRegistration(stored) || stored.unregistered) {
    return false;
  }

  const channels = await determineNotificationChannelsStep(
    snapshot.userId,
    trackedDomainId,
    "registrationChanges",
  );

  if (!hasAnyChannel(channels)) {
    await updateRegistrationSnapshot(trackedDomainId, {
      ...stored,
      pending: null,
      unregistered: true,
    });
    return false;
  }

  // Same one-hour confirmation as other registration changes; a fixed key
  // distinct from any registrationObservationKey output.
  const confirmation = confirmChange(stored.pending, "unregistered");

  if (!confirmation.confirmed) {
    await updateRegistrationSnapshot(trackedDomainId, {
      ...stored,
      pending: confirmation.pending,
    });
    return false;
  }

  const previousRegistrarId = stored.registrarProviderId;
  const registrarNames = previousRegistrarId
    ? await resolveProviderNamesStep([previousRegistrarId])
    : new Map<string, string>();
  const previousRegistrar = previousRegistrarId
    ? (registrarNames.get(previousRegistrarId) ?? previousRegistrarId)
    : null;

  await sendChangeNotificationStep(
    {
      ...recipientOf(ctx),
      ...describeUnregistered(snapshot.domainName, previousRegistrar),
      type: "registration_change",
      changes: {
        unregistered: true,
        registrarChanged: false,
        nameserversChanged: false,
        transferLockChanged: false,
        statusesChanged: false,
        previousRegistrar,
        previousNameservers: stored.nameservers ?? [],
        previousTransferLock: stored.transferLock ?? null,
        previousStatuses: stored.statuses ?? [],
        newRegistrar: null,
        newNameservers: [],
        newTransferLock: null,
        newStatuses: [],
      },
      idempotencyKey: `registration:${trackedDomainId}:${registrationObservationKey(stored)}>unregistered`,
    },
    channels,
  );

  await updateRegistrationSnapshot(trackedDomainId, {
    ...stored,
    pending: null,
    unregistered: true,
  });
  return true;
}

/** Step 4: DNS, hosting, and email provider changes. */
async function checkProviders(
  ctx: CheckContext,
  { dnsResult, headersResult, ip, geoResult, providers }: Observation,
): Promise<boolean> {
  const { trackedDomainId, snapshot } = ctx;

  // An empty DNS record set means we could not observe the domain's providers —
  // either every resolver failed or the domain resolves to nothing right now.
  // Either way it is not evidence that the providers were removed, and treating
  // it as such emails users a false "provider removed" alert and then advances
  // the snapshot so the recovery looks like a second change.
  if (dnsResult.records.length === 0) {
    return false;
  }

  // Hosting is derived from HTTP headers (catalog match), falling back to the
  // IP owner from GeoIP. When the domain has an address but either input was
  // unavailable this run, the derived value is not evidence of a change —
  // compare against the stored provider instead (same rule as the DNS check).
  const hostingObserved = ip === null || (headersResult?.success === true && geoResult !== null);

  const currentProviderIds = {
    dns: providers.dnsProvider?.id ?? null,
    hosting: hostingObserved ? (providers.hostingProvider?.id ?? null) : snapshot.hostingProviderId,
    email: providers.emailProvider?.id ?? null,
  };
  const storedProviderSnapshot = {
    dnsProviderId: snapshot.dnsProviderId,
    hostingProviderId: snapshot.hostingProviderId,
    emailProviderId: snapshot.emailProviderId,
  };
  const currentProviderSnapshot = {
    dnsProviderId: currentProviderIds.dns,
    hostingProviderId: currentProviderIds.hosting,
    emailProviderId: currentProviderIds.email,
  };

  const providerChange = detectProviderChange(storedProviderSnapshot, currentProviderSnapshot);

  if (!providerChange) {
    // No difference from the stored snapshot: clear a stale pending
    // observation if one is set (the wobble went away).
    if (snapshot.providerPending) {
      await updateProviderPending(trackedDomainId, null);
    }
    return false;
  }

  const channels = await determineNotificationChannelsStep(
    snapshot.userId,
    trackedDomainId,
    "providerChanges",
  );

  if (!hasAnyChannel(channels)) {
    // Muted / disabled: advance on detection so we don't infinitely
    // re-detect (see checkRegistration).
    await updateProviderSnapshot(trackedDomainId, currentProviderIds);
    return false;
  }

  // Require a repeat observation before notifying — a single differing
  // lookup is often a transient wobble (see confirmChange).
  const confirmation = confirmChange(
    snapshot.providerPending,
    providerObservationKey(currentProviderSnapshot),
  );

  if (!confirmation.confirmed) {
    await updateProviderPending(trackedDomainId, confirmation.pending);
    return false;
  }

  const providerNames = await resolveProviderNamesStep(
    [
      snapshot.dnsProviderId,
      snapshot.hostingProviderId,
      snapshot.emailProviderId,
      currentProviderIds.dns,
      currentProviderIds.hosting,
      currentProviderIds.email,
    ].filter((id): id is string => id !== null),
  );

  const changes: ProviderChangeWithNames = {
    ...providerChange,
    previousDnsProvider: nameOf(providerNames, providerChange.previousDnsProviderId),
    newDnsProvider: nameOf(providerNames, providerChange.newDnsProviderId),
    previousHostingProvider: nameOf(providerNames, providerChange.previousHostingProviderId),
    newHostingProvider: nameOf(providerNames, providerChange.newHostingProviderId),
    previousEmailProvider: nameOf(providerNames, providerChange.previousEmailProviderId),
    newEmailProvider: nameOf(providerNames, providerChange.newEmailProviderId),
  };

  await sendChangeNotificationStep(
    {
      ...recipientOf(ctx),
      ...describeProviderChange(changes, snapshot.domainName),
      type: "provider_change",
      changes,
      idempotencyKey: `provider:${trackedDomainId}:${providerObservationKey(storedProviderSnapshot)}>${providerObservationKey(currentProviderSnapshot)}`,
    },
    channels,
  );

  // Advance only after delivery (see checkRegistration).
  await updateProviderSnapshot(trackedDomainId, currentProviderIds);
  return true;
}

/** Step 5: leaf certificate renewals and authority/issuer changes. */
async function checkCertificate(
  ctx: CheckContext,
  certificates: Observation["certificates"],
): Promise<boolean> {
  const { trackedDomainId, snapshot } = ctx;

  const leafCert = certificates.length > 0 ? findLeafCertificate(certificates) : null;
  if (!leafCert) {
    return false;
  }

  const currentCertificate = certificateSnapshotFrom(leafCert);
  const evaluation = evaluateCertificateChange(snapshot.certificate, currentCertificate);

  // Every path below ends by writing the evaluated snapshot (when there is one):
  // after delivery when notifying, and on detection when muted or not notable.
  const persistCertificateSnapshot = async () => {
    if (evaluation.snapshotToWrite) {
      await updateCertificateSnapshot(trackedDomainId, evaluation.snapshotToWrite);
    }
  };

  if (!evaluation.shouldNotify) {
    await persistCertificateSnapshot();
    return false;
  }

  const channels = await determineNotificationChannelsStep(
    snapshot.userId,
    trackedDomainId,
    "certificateChanges",
  );

  if (!hasAnyChannel(channels)) {
    await persistCertificateSnapshot();
    return false;
  }

  const certificateChange = evaluation.change;
  const caProviderNames = await resolveProviderNamesStep(
    [certificateChange.previousCaProviderId, certificateChange.newCaProviderId].filter(
      (id): id is string => id !== null,
    ),
  );
  const changes: CertificateChangeWithNames = {
    ...certificateChange,
    previousCaProvider: nameOf(caProviderNames, certificateChange.previousCaProviderId),
    newCaProvider: nameOf(caProviderNames, certificateChange.newCaProviderId),
  };

  await sendChangeNotificationStep(
    {
      ...recipientOf(ctx),
      ...describeCertificateChange(
        evaluation.kind,
        changes,
        currentCertificate.validTo,
        snapshot.domainName,
      ),
      type: "certificate_change",
      changes,
      kind: evaluation.kind,
      newValidTo: currentCertificate.validTo,
      idempotencyKey: `certificate:${trackedDomainId}:${snapshot.certificate.fingerprint ?? snapshot.certificate.serialNumber ?? ""}>${currentCertificate.fingerprint ?? currentCertificate.serialNumber ?? ""}`,
    },
    channels,
  );

  // Advance only after delivery (see checkRegistration).
  await persistCertificateSnapshot();
  return true;
}

// --- Step Functions ---

async function releaseMonitorLockStep(
  trackedDomainId: string,
  monitorLockOwnerToken: string,
): Promise<void> {
  "use step";

  const { releaseMonitorLock } = await import("../lib/monitor-lock");
  await releaseMonitorLock(trackedDomainId, monitorLockOwnerToken);
}

async function fetchSnapshot(trackedDomainId: string): Promise<SnapshotForMonitoring | null> {
  "use step";

  const { getSnapshot } = await import("@domainstack/db/queries/snapshots");
  return await getSnapshot(trackedDomainId);
}

async function updateRegistrationSnapshot(
  trackedDomainId: string,
  registration: RegistrationSnapshotData,
): Promise<void> {
  "use step";

  const { updateSnapshot } = await import("@domainstack/db/queries/snapshots");
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

  const { updateSnapshot } = await import("@domainstack/db/queries/snapshots");
  await updateSnapshot(trackedDomainId, {
    dnsProviderId: providers.dns,
    hostingProviderId: providers.hosting,
    emailProviderId: providers.email,
    providerPending: null,
  });
}

async function updateProviderPending(
  trackedDomainId: string,
  providerPending: PendingChangeObservation | null,
): Promise<void> {
  "use step";

  const { updateSnapshot } = await import("@domainstack/db/queries/snapshots");
  await updateSnapshot(trackedDomainId, { providerPending });
}

async function updateCertificateSnapshot(
  trackedDomainId: string,
  certificate: CertificateSnapshotData,
): Promise<void> {
  "use step";

  const { updateSnapshot } = await import("@domainstack/db/queries/snapshots");
  await updateSnapshot(trackedDomainId, { certificate });
}

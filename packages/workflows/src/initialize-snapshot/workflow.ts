import type {
  CertificateSnapshotData,
  DnssecSnapshotData,
  RegistrationSnapshotData,
} from "@domainstack/types";
import {
  certificateSnapshotFrom,
  dnssecSnapshotFrom,
  registrationSnapshotFrom,
} from "@domainstack/utils/change-detection";
import { findLeafCertificate } from "@domainstack/utils/tls";

import { observeDomain } from "../steps/observe-domain";

interface InitializeSnapshotWorkflowInput {
  trackedDomainId: string;
  domainId: string;
}

type InitializeSnapshotWorkflowResult =
  | { success: true; snapshotId: string }
  | { success: false; error: "domain_not_found" | "dns_unobserved" | "snapshot_exists" };

/**
 * Durable workflow to create a baseline snapshot for a newly verified tracked domain.
 *
 * This establishes the initial state for change detection by fetching
 * current registration, hosting, and certificate data.
 */
export async function initializeSnapshotWorkflow(
  input: InitializeSnapshotWorkflowInput,
): Promise<InitializeSnapshotWorkflowResult> {
  "use workflow";

  const { trackedDomainId, domainId } = input;

  // Step 1: Fetch domain name
  const domainRecord = await fetchDomainStep(domainId);

  if (!domainRecord) {
    return { success: false, error: "domain_not_found" };
  }

  const domainName = domainRecord.name;

  // Step 2: Fetch and persist fresh data
  const { registrationData, dnsResult, certificates, providers } = await observeDomain(domainName);

  // Build registration snapshot
  let registrationSnapshot: RegistrationSnapshotData = {
    registrarProviderId: null,
    nameservers: [],
    transferLock: null,
    statuses: [],
  };

  if (registrationData?.status === "registered") {
    registrationSnapshot = registrationSnapshotFrom(registrationData);
  }

  // Build certificate snapshot
  let certificateSnapshot: CertificateSnapshotData = {
    caProviderId: null,
    issuer: "",
    validTo: "",
    fingerprint: null,
    serialNumber: null,
  };

  if (certificates.length > 0) {
    const leafCert = findLeafCertificate(certificates);

    if (leafCert) {
      certificateSnapshot = certificateSnapshotFrom(leafCert);
    }
  }

  // An empty DNS record set means we could not observe the domain's providers —
  // either every resolver failed or the domain resolves to nothing right now.
  // Writing that as the baseline would lock in an all-null provider snapshot,
  // and the first time providers are actually observed later, detect-changes
  // would read that as "provider added" and send a false alert. Skip creating
  // a snapshot this run; the domain stays in getVerifiedDomainsWithoutSnapshots()
  // and the next cron cycle retries it.
  const dnsObserved = dnsResult.records.length > 0;

  if (!dnsObserved) {
    return { success: false, error: "dns_unobserved" };
  }

  // Step 3: Create the baseline snapshot
  const snapshot = await createSnapshotStep({
    trackedDomainId,
    registration: registrationSnapshot,
    certificate: certificateSnapshot,
    dnsProviderId: providers.dnsProvider?.id ?? null,
    hostingProviderId: providers.hostingProvider?.id ?? null,
    emailProviderId: providers.emailProvider?.id ?? null,
    // null when DNSSEC was unobservable: the first monitoring run adopts it silently
    dnssec: dnssecSnapshotFrom(dnsResult.dnssec),
  });

  if (!snapshot) {
    return { success: false, error: "snapshot_exists" };
  }

  return { success: true, snapshotId: snapshot.id };
}

async function fetchDomainStep(domainId: string): Promise<{ name: string } | null> {
  "use step";

  const { getDomainNameById } = await import("@domainstack/db/queries/domains");
  return getDomainNameById(domainId);
}

async function createSnapshotStep(params: {
  trackedDomainId: string;
  registration: RegistrationSnapshotData;
  certificate: CertificateSnapshotData;
  dnsProviderId: string | null;
  hostingProviderId: string | null;
  emailProviderId: string | null;
  dnssec: DnssecSnapshotData | null;
}): Promise<{ id: string } | null> {
  "use step";

  const { createSnapshot } = await import("@domainstack/db/queries/snapshots");

  let snapshot: Awaited<ReturnType<typeof createSnapshot>>;
  try {
    snapshot = await createSnapshot({
      trackedDomainId: params.trackedDomainId,
      registration: params.registration,
      certificate: params.certificate,
      dnsProviderId: params.dnsProviderId,
      hostingProviderId: params.hostingProviderId,
      emailProviderId: params.emailProviderId,
      dnssec: params.dnssec,
    });
  } catch (err) {
    const { classifyDatabaseError } = await import("../lib/errors");
    throw classifyDatabaseError(err, {
      context: `creating snapshot for ${params.trackedDomainId}`,
    });
  }

  // null: a snapshot already exists (another baseline or the monitor got there first).
  return snapshot ? { id: snapshot.id } : null;
}

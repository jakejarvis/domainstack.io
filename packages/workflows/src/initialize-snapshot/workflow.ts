import type {
  Certificate,
  CertificateSnapshotData,
  RegistrationResponse,
  RegistrationSnapshotData,
} from "@domainstack/types";
import { findLeafCertificate } from "@domainstack/utils/tls";

import { optionalCall, optionalSettled, requireSettled } from "../lib/settled";
import {
  fetchCertificateChainStep,
  persistCertificatesStep,
  processChainStep,
} from "../steps/certificates";
import { fetchDnsRecordsStep, persistDnsRecordsStep } from "../steps/dns";
import { fetchHeadersStep, persistHeadersStep } from "../steps/headers";
import {
  detectAndResolveProvidersStep,
  lookupGeoIpStep,
  persistHostingStep,
} from "../steps/hosting";
import {
  lookupWhoisStep,
  normalizeAndBuildResponseStep,
  persistRegistrationStep,
} from "../steps/registration";

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

  // Step 2: Fetch fresh data. Headers/certs are enrichment — a domain with no
  // A/AAAA (or an unreachable host) must still get a baseline snapshot.
  const [registrationSettled, dnsSettled, headersSettled, certificatesSettled] =
    await Promise.allSettled([
      lookupWhoisStep(domainName),
      fetchDnsRecordsStep(domainName),
      fetchHeadersStep(domainName),
      fetchCertificateChainStep(domainName),
    ]);

  // WHOIS/headers/certs are enrichment. RDAP timeouts and unreachable
  // HTTP/TLS hosts must not prevent a baseline snapshot. DNS is required.
  const registrationResult = optionalSettled(registrationSettled);
  const dnsResult = requireSettled(dnsSettled);
  const headersResult = optionalSettled(headersSettled);
  const certificatesResult = optionalSettled(certificatesSettled);

  // Process and persist registration
  let registrationData: RegistrationResponse | null = null;
  if (registrationResult?.success) {
    registrationData = await normalizeAndBuildResponseStep(registrationResult.data.recordJson);
    // Persist registered and unregistered alike, so a drop updates the cache
    await optionalCall(persistRegistrationStep(domainName, registrationData));
  }

  // The DNS cache is a side effect here: detection uses dnsResult directly, so a
  // failed write must not abort the run (same rule as the other persists).
  await optionalCall(persistDnsRecordsStep(domainName, dnsResult));

  if (headersResult?.success) {
    await optionalCall(persistHeadersStep(domainName, headersResult.data));
  }

  // Process and persist certificates
  let certificates: Certificate[] = [];
  if (certificatesResult?.success) {
    const processed = await optionalCall(processChainStep(certificatesResult));
    if (processed) {
      await optionalCall(persistCertificatesStep(domainName, processed));
      certificates = processed.certificates;
    }
  }

  // Hosting detection uses DNS even when headers fail (no A/AAAA, etc.)
  const a = dnsResult.records.find((d) => d.type === "A");
  const aaaa = dnsResult.records.find((d) => d.type === "AAAA");
  const ip = (a?.value || aaaa?.value) ?? null;
  const geoResult = ip ? await optionalCall(lookupGeoIpStep(ip)) : null;
  const headers = headersResult?.success ? headersResult.data.headers : [];

  const providers = await detectAndResolveProvidersStep(dnsResult.records, headers, geoResult);

  await optionalCall(persistHostingStep(domainName, providers, geoResult?.geo ?? null));

  // Build registration snapshot
  let registrationSnapshot: RegistrationSnapshotData = {
    registrarProviderId: null,
    nameservers: [],
    transferLock: null,
    statuses: [],
  };

  if (registrationData?.status === "registered") {
    registrationSnapshot = {
      registrarProviderId: registrationData.registrarProvider.id ?? null,
      nameservers: registrationData.nameservers || [],
      transferLock: registrationData.transferLock ?? null,
      statuses: (registrationData.statuses ?? []).map((status) => status.status),
    };
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
      certificateSnapshot = {
        caProviderId: leafCert.caProvider.id ?? null,
        issuer: leafCert.issuer,
        validTo: new Date(leafCert.validTo).toISOString(),
        fingerprint: leafCert.fingerprint256,
        serialNumber: leafCert.serialNumber,
      };
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
}): Promise<{ id: string } | null> {
  "use step";

  const { createSnapshot } = await import("@domainstack/db/queries/snapshots");

  const snapshot = await createSnapshot({
    trackedDomainId: params.trackedDomainId,
    registration: params.registration,
    certificate: params.certificate,
    dnsProviderId: params.dnsProviderId,
    hostingProviderId: params.hostingProviderId,
    emailProviderId: params.emailProviderId,
  });

  // null: a snapshot already exists (another baseline or the monitor got there first).
  return snapshot ? { id: snapshot.id } : null;
}

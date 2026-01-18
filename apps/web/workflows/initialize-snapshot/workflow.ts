import type { CertificatesResponse } from "@/lib/types/domain/certificates";
import type { HostingResponse } from "@/lib/types/domain/hosting";
import type { RegistrationResponse } from "@/lib/types/domain/registration";
import {
  fetchCertificateChainStep,
  persistCertificatesStep,
  processChainStep,
} from "@/workflows/shared/certificates";
import {
  fetchDnsRecordsStep,
  persistDnsRecordsStep,
} from "@/workflows/shared/dns";
import {
  fetchHeadersStep,
  persistHeadersStep,
} from "@/workflows/shared/headers";
import {
  detectAndResolveProvidersStep,
  lookupGeoIpStep,
  persistHostingStep,
} from "@/workflows/shared/hosting";
import {
  lookupWhoisStep,
  normalizeAndBuildResponseStep,
  persistRegistrationStep,
} from "@/workflows/shared/registration";

export interface InitializeSnapshotWorkflowInput {
  trackedDomainId: string;
  domainId: string;
}

export type InitializeSnapshotWorkflowResult =
  | { success: true; snapshotId: string }
  | { success: false; error: string };

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

  // Step 2: Fetch fresh data for this domain (parallel where possible)
  const [registrationResult, dnsResult, headersResult, certificatesResult] =
    await Promise.all([
      lookupWhoisStep(domainName),
      fetchDnsRecordsStep(domainName),
      fetchHeadersStep(domainName),
      fetchCertificateChainStep(domainName),
    ]);

  // Process and persist registration
  let registrationData: RegistrationResponse | null = null;
  if (registrationResult.success) {
    registrationData = await normalizeAndBuildResponseStep(
      registrationResult.data.recordJson,
    );
    if (registrationData.isRegistered) {
      await persistRegistrationStep(domainName, registrationData);
    }
  }

  // Persist DNS (always succeeds or throws)
  await persistDnsRecordsStep(domainName, dnsResult.data);

  // Persist headers (if succeeded)
  if (headersResult.success) {
    await persistHeadersStep(domainName, headersResult.data);
  }

  // Process and persist certificates
  let certificatesData: CertificatesResponse | null = null;
  if (certificatesResult.success) {
    const processed = await processChainStep(certificatesResult.data.chainJson);
    await persistCertificatesStep(domainName, processed);
    certificatesData = { certificates: processed.certificates };
  }

  // Compute and persist hosting using DNS + headers data
  let hostingData: HostingResponse | null = null;
  if (headersResult.success) {
    const a = dnsResult.data.records.find((d) => d.type === "A");
    const aaaa = dnsResult.data.records.find((d) => d.type === "AAAA");
    const ip = (a?.value || aaaa?.value) ?? null;
    const geoResult = ip ? await lookupGeoIpStep(ip) : null;

    const providers = await detectAndResolveProvidersStep(
      dnsResult.data.records,
      headersResult.data.headers,
      geoResult,
    );

    await persistHostingStep(domainName, providers, geoResult?.geo ?? null);

    hostingData = {
      hostingProvider: providers.hostingProvider,
      emailProvider: providers.emailProvider,
      dnsProvider: providers.dnsProvider,
      geo: geoResult?.geo ?? null,
    };
  }

  // Build registration snapshot
  let registrationSnapshot: {
    registrarProviderId: string | null;
    nameservers: { host: string }[];
    transferLock: boolean | null;
    statuses: string[];
  } = {
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
      statuses: (registrationData.statuses || []).map(
        (s: string | { status: string }) =>
          typeof s === "string" ? s : s.status,
      ),
    };
  }

  // Build certificate snapshot
  let certificateSnapshot: {
    caProviderId: string | null;
    issuer: string;
    validTo: string;
    fingerprint: string | null;
  } = {
    caProviderId: null,
    issuer: "",
    validTo: new Date().toISOString(),
    fingerprint: null,
  };

  if (certificatesData && certificatesData.certificates.length > 0) {
    const [leafCert] = certificatesData.certificates;

    certificateSnapshot = {
      caProviderId: leafCert.caProvider.id ?? null,
      issuer: leafCert.issuer,
      validTo: new Date(leafCert.validTo).toISOString(),
      fingerprint: null,
    };
  }

  // Resolve provider IDs from hosting data
  const providerIds = {
    dns: hostingData?.dnsProvider?.id ?? null,
    hosting: hostingData?.hostingProvider?.id ?? null,
    email: hostingData?.emailProvider?.id ?? null,
  };

  // Step 3: Create the baseline snapshot
  const snapshot = await createSnapshotStep({
    trackedDomainId,
    registration: registrationSnapshot,
    certificate: certificateSnapshot,
    dnsProviderId: providerIds.dns,
    hostingProviderId: providerIds.hosting,
    emailProviderId: providerIds.email,
  });

  return { success: true, snapshotId: snapshot.id };
}

async function fetchDomainStep(
  domainId: string,
): Promise<{ name: string } | null> {
  "use step";

  const { getDomainNameById } = await import("@/lib/db/repos/domains");
  return getDomainNameById(domainId);
}

async function createSnapshotStep(params: {
  trackedDomainId: string;
  registration: {
    registrarProviderId: string | null;
    nameservers: { host: string }[];
    transferLock: boolean | null;
    statuses: string[];
  };
  certificate: {
    caProviderId: string | null;
    issuer: string;
    validTo: string;
    fingerprint: string | null;
  };
  dnsProviderId: string | null;
  hostingProviderId: string | null;
  emailProviderId: string | null;
}): Promise<{ id: string }> {
  "use step";

  const { createSnapshot } = await import("@/lib/db/repos/snapshots");

  return await createSnapshot({
    trackedDomainId: params.trackedDomainId,
    registration: params.registration,
    certificate: params.certificate,
    dnsProviderId: params.dnsProviderId,
    hostingProviderId: params.hostingProviderId,
    emailProviderId: params.emailProviderId,
  });
}

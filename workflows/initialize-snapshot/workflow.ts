import type {
  CertificatesResponse,
  HostingResponse,
  RegistrationResponse,
} from "@/lib/types";
import { fetchCertificatesData } from "@/workflows/shared/fetch-certificates";
import { fetchDnsData } from "@/workflows/shared/fetch-dns";
import { fetchHeadersData } from "@/workflows/shared/fetch-headers";
import { fetchHostingData } from "@/workflows/shared/fetch-hosting";
import { fetchRegistrationData } from "@/workflows/shared/fetch-registration";

export interface InitializeSnapshotWorkflowInput {
  trackedDomainId: string;
  domainId: string;
}

export type InitializeSnapshotWorkflowResult =
  | { success: true; snapshotId: string }
  | { success: false; error: string };

/**
 * Durable workflow to initialize a snapshot for a newly verified tracked domain.
 *
 * This establishes the baseline state for change detection by fetching
 * current registration, hosting, and certificate data.
 */
export async function initializeSnapshotWorkflow(
  input: InitializeSnapshotWorkflowInput,
): Promise<InitializeSnapshotWorkflowResult> {
  "use workflow";

  const { trackedDomainId, domainId } = input;

  // Step 1: Fetch domain name
  const domainRecord = await fetchDomainName(domainId);

  if (!domainRecord) {
    return { success: false, error: "domain_not_found" };
  }

  const domainName = domainRecord.name;

  // Step 2: Fetch fresh data for this domain using shared steps (parallel where possible)
  // First, fetch the independent data sources in parallel
  const [registrationResult, dnsResult, headersResult, certificatesResult] =
    await Promise.all([
      fetchRegistrationData(domainName),
      fetchDnsData(domainName),
      fetchHeadersData(domainName),
      fetchCertificatesData(domainName),
    ]);

  // Then compute hosting using DNS + headers data (depends on previous results)
  const dnsRecords = dnsResult.data?.records ?? [];
  const headers = headersResult.data?.headers ?? [];
  const hostingResult = await fetchHostingData(domainName, dnsRecords, headers);

  // Extract data from step results
  const registrationData: RegistrationResponse | null =
    registrationResult.success ? registrationResult.data : null;
  const certificatesData: CertificatesResponse = certificatesResult.success
    ? certificatesResult.data
    : { certificates: [] };
  const hostingData: HostingResponse | null = hostingResult.success
    ? hostingResult.data
    : null;

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

  if (certificatesData.certificates.length > 0) {
    const leafCert = certificatesData.certificates[0];

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

  // Step 3: Create the snapshot
  const snapshot = await createSnapshotRecord({
    trackedDomainId,
    registration: registrationSnapshot,
    certificate: certificateSnapshot,
    dnsProviderId: providerIds.dns,
    hostingProviderId: providerIds.hosting,
    emailProviderId: providerIds.email,
  });

  return { success: true, snapshotId: snapshot.id };
}

async function fetchDomainName(
  domainId: string,
): Promise<{ name: string } | null> {
  "use step";

  const { eq } = await import("drizzle-orm");
  const { db } = await import("@/lib/db/client");
  const { domains } = await import("@/lib/db/schema");

  const result = await db
    .select({ name: domains.name })
    .from(domains)
    .where(eq(domains.id, domainId))
    .limit(1);

  return result[0] ?? null;
}

async function createSnapshotRecord(params: {
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

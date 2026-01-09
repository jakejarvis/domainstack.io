import { start } from "workflow/api";
import type {
  CertificatesResponse,
  HostingResponse,
  RegistrationResponse,
} from "@/lib/types";
import {
  type CertificatesWorkflowResult,
  certificatesWorkflow,
} from "@/workflows/certificates";
import { dnsWorkflow } from "@/workflows/dns";
import { headersWorkflow } from "@/workflows/headers";
import {
  type HostingWorkflowResult,
  hostingWorkflow,
} from "@/workflows/hosting";
import {
  type RegistrationWorkflowResult,
  registrationWorkflow,
} from "@/workflows/registration";

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

  // Step 2: Fetch fresh data for this domain using workflows
  const [registrationResult, hostingResult, certificatesResult] =
    await fetchData(domainName);

  // Extract data from workflow results
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

async function fetchData(
  domainName: string,
): Promise<
  [
    RegistrationWorkflowResult,
    HostingWorkflowResult,
    CertificatesWorkflowResult,
  ]
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
  // Guard against null data from failed workflows
  const dnsRecords = dnsResult.data?.records ?? [];
  const headers = headersResult.data?.headers ?? [];

  const hostingRun = await start(hostingWorkflow, [
    {
      domain: domainName,
      dnsRecords,
      headers,
    },
  ]);
  const hostingResult = await hostingRun.returnValue;

  return [regResult, hostingResult, certsResult];
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

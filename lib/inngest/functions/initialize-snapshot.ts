import "server-only";

import { eq } from "drizzle-orm";
import { start } from "workflow/api";
import { db } from "@/lib/db/client";
import { createSnapshot } from "@/lib/db/repos/snapshots";
import { domains } from "@/lib/db/schema";
import { inngest } from "@/lib/inngest/client";
import { INNGEST_EVENTS } from "@/lib/inngest/events";
import { getHosting } from "@/server/services/hosting";
import { certificatesWorkflow } from "@/workflows/certificates";
import { registrationWorkflow } from "@/workflows/registration";

/**
 * Initialize a snapshot for a newly verified tracked domain.
 * This establishes the baseline state for change detection.
 */
export const initializeSnapshot = inngest.createFunction(
  {
    id: "initialize-snapshot",
    retries: 3,
  },
  { event: INNGEST_EVENTS.SNAPSHOT_INITIALIZE },
  async ({ event, step, logger: inngestLogger }) => {
    const { trackedDomainId, domainId } = event.data;

    // Fetch domain name
    const domainRecord = await step.run("fetch-domain", async () => {
      const result = await db
        .select({ name: domains.name })
        .from(domains)
        .where(eq(domains.id, domainId))
        .limit(1);

      return result[0];
    });

    if (!domainRecord) {
      inngestLogger.error("Domain not found", { domainId });
      return { success: false, reason: "domain_not_found" };
    }

    const domainName = domainRecord.name;

    // Fetch fresh data for this domain using workflows
    const [registrationResult, hostingData, certificatesResult] =
      await step.run("fetch-data", async () => {
        // Start workflows and fetch hosting in parallel
        const [regRun, hostingPromise, certRun] = await Promise.all([
          start(registrationWorkflow, [{ domain: domainName }]),
          getHosting(domainName),
          start(certificatesWorkflow, [{ domain: domainName }]),
        ]);

        // Wait for workflow results
        const [regResult, certsResult] = await Promise.all([
          regRun.returnValue,
          certRun.returnValue,
        ]);

        return [regResult, hostingPromise, certsResult] as const;
      });

    // Extract data from workflow results
    const registrationData = registrationResult.success
      ? registrationResult.data
      : null;
    const certificatesData = certificatesResult.success
      ? certificatesResult.data
      : { certificates: [] };

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
        statuses: (registrationData.statuses || []).map((s) =>
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
        fingerprint: null, // TODO: Add fingerprint extraction when TLS probe supports it
      };
    }

    // Resolve provider IDs from hosting data
    const providerIds = {
      dns: hostingData?.dnsProvider?.id ?? null,
      hosting: hostingData?.hostingProvider?.id ?? null,
      email: hostingData?.emailProvider?.id ?? null,
    };

    // Create the snapshot
    const snapshot = await step.run("create-snapshot", async () => {
      return await createSnapshot({
        trackedDomainId,
        registration: registrationSnapshot,
        certificate: certificateSnapshot,
        dnsProviderId: providerIds.dns,
        hostingProviderId: providerIds.hosting,
        emailProviderId: providerIds.email,
      });
    });

    return { success: true, snapshotId: snapshot.id };
  },
);

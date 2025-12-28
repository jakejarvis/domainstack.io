import "server-only";

import { eq } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { createSnapshot } from "@/lib/db/repos/snapshots";
import { domains } from "@/lib/db/schema";
import { inngest } from "@/lib/inngest/client";
import { INNGEST_EVENTS } from "@/lib/inngest/events";
import type {
  CertificateSnapshotData,
  RegistrationSnapshotData,
} from "@/lib/schemas";
import { getCertificates } from "@/server/services/certificates";
import { getHosting } from "@/server/services/hosting";
import { getRegistration } from "@/server/services/registration";

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
    inngestLogger.info("Initializing snapshot", {
      domainName,
      trackedDomainId,
    });

    // Fetch fresh data for this domain
    const [registrationData, hostingData, certificatesData] = await step.run(
      "fetch-data",
      async () => {
        return await Promise.all([
          getRegistration(domainName),
          getHosting(domainName),
          getCertificates(domainName),
        ]);
      },
    );

    // Build registration snapshot
    let registrationSnapshot: RegistrationSnapshotData = {
      registrarProviderId: null,
      nameservers: [],
      transferLock: null,
      statuses: [],
    };

    if (registrationData.status === "registered") {
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
    let certificateSnapshot: CertificateSnapshotData = {
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

    inngestLogger.info("Snapshot initialized", {
      domainName,
      trackedDomainId,
      snapshotId: snapshot.id,
    });

    return { success: true, snapshotId: snapshot.id };
  },
);

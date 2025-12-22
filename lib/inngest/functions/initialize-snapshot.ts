import "server-only";

import { eq, inArray } from "drizzle-orm";
import { db } from "@/lib/db/client";
import {
  type CertificateSnapshotData,
  createSnapshot,
  type RegistrationSnapshotData,
} from "@/lib/db/repos/snapshots";
import { domains, providers } from "@/lib/db/schema";
import { inngest } from "@/lib/inngest/client";
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
  { event: "snapshot/initialize" },
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
        registrarProviderId: registrationData.registrarProvider.name || null,
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

    if (certificatesData.length > 0) {
      const leafCert = certificatesData[0];

      // Resolve CA provider ID from name
      const caProviderId = await step.run("resolve-ca-id", async () => {
        if (!leafCert.caProvider?.name) return null;

        const providersData = await db
          .select({ id: providers.id })
          .from(providers)
          .where(eq(providers.name, leafCert.caProvider.name))
          .limit(1);

        return providersData[0]?.id || null;
      });

      certificateSnapshot = {
        caProviderId,
        issuer: leafCert.issuer,
        validTo: new Date(leafCert.validTo).toISOString(),
        fingerprint: null,
      };
    }

    // Resolve provider IDs from hosting data
    const providerIds = await step.run("resolve-provider-ids", async () => {
      if (!hostingData) {
        return { dns: null, hosting: null, email: null };
      }

      const names = [
        hostingData.dnsProvider?.name,
        hostingData.hostingProvider?.name,
        hostingData.emailProvider?.name,
      ].filter((n): n is string => n !== null);

      if (names.length === 0) {
        return { dns: null, hosting: null, email: null };
      }

      const providersData = await db
        .select({ name: providers.name, id: providers.id })
        .from(providers)
        .where(inArray(providers.name, names));

      const nameToId = Object.fromEntries(
        providersData.map((p) => [p.name, p.id]),
      );

      return {
        dns: hostingData.dnsProvider?.name
          ? nameToId[hostingData.dnsProvider.name] || null
          : null,
        hosting: hostingData.hostingProvider?.name
          ? nameToId[hostingData.hostingProvider.name] || null
          : null,
        email: hostingData.emailProvider?.name
          ? nameToId[hostingData.emailProvider.name] || null
          : null,
      };
    });

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

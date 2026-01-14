/**
 * Registration persist step.
 *
 * Persists registration data to the database.
 * This step is shared between the dedicated registrationWorkflow and internal workflows.
 *
 * Note: This step only handles database persistence. Revalidation scheduling
 * should be done at the workflow level using scheduleRevalidationBatchStep.
 */

import type { RegistrationResponse } from "@/lib/types/domain/registration";

/** Result from persist step, includes lastAccessedAt for scheduling */
export interface PersistResult {
  domainId: string;
  lastAccessedAt: Date | null;
}

/**
 * Step: Persist registration to database.
 *
 * Creates/updates domain record. Returns lastAccessedAt for use in
 * scheduling revalidation at the workflow level.
 * Only call this for registered domains (isRegistered: true).
 *
 * @param domain - The domain name
 * @param response - The normalized registration response
 * @returns Object with domainId and lastAccessedAt for scheduling
 */
export async function persistRegistrationStep(
  domain: string,
  response: RegistrationResponse,
): Promise<PersistResult> {
  "use step";

  // Dynamic imports for Node.js modules and database operations
  const { getStepMetadata } = await import("workflow");
  const { getDomainTld } = await import("rdapper");
  const { createLogger } = await import("@/lib/logger/server");
  const { ttlForRegistration } = await import("@/lib/ttl");
  const { upsertDomain } = await import("@/lib/db/repos/domains");
  const { upsertRegistration } = await import("@/lib/db/repos/registrations");

  const { stepId } = getStepMetadata();
  const logger = createLogger({ source: "registration-persist" });
  const now = new Date();

  try {
    const domainRecord = await upsertDomain({
      name: domain,
      tld: getDomainTld(domain) ?? "",
      unicodeName: response.unicodeName ?? domain,
    });

    const expiresAt = ttlForRegistration(
      now,
      response.expirationDate ? new Date(response.expirationDate) : null,
    );

    await upsertRegistration({
      domainId: domainRecord.id,
      isRegistered: response.isRegistered,
      privacyEnabled: response.privacyEnabled ?? false,
      registry: response.registry ?? null,
      creationDate: response.creationDate
        ? new Date(response.creationDate)
        : null,
      updatedDate: response.updatedDate ? new Date(response.updatedDate) : null,
      expirationDate: response.expirationDate
        ? new Date(response.expirationDate)
        : null,
      deletionDate: response.deletionDate
        ? new Date(response.deletionDate)
        : null,
      transferLock: response.transferLock ?? null,
      statuses: response.statuses ?? [],
      contacts: response.contacts ?? [],
      whoisServer: response.whoisServer ?? null,
      rdapServers: response.rdapServers ?? [],
      source: response.source ?? "rdap",
      registrarProviderId: response.registrarProvider.id,
      resellerProviderId: null,
      fetchedAt: now,
      expiresAt,
      nameservers: (response.nameservers ?? []).map((n) => ({
        host: n.host,
        ipv4: n.ipv4 ?? [],
        ipv6: n.ipv6 ?? [],
      })),
      rawResponse: response.rawResponse,
    });

    logger.debug({ domain, stepId }, "registration persisted");

    return {
      domainId: domainRecord.id,
      lastAccessedAt: domainRecord.lastAccessedAt ?? null,
    };
  } catch (err) {
    const { classifyDatabaseError } = await import("@/lib/workflow/errors");
    throw classifyDatabaseError(err, {
      context: `persisting registration for ${domain}`,
    });
  }
}

import "server-only";
import type { InferInsertModel } from "drizzle-orm";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { domains, providers, registrations } from "@/lib/db/schema";
import type {
  RegistrationContact,
  RegistrationNameserver,
  RegistrationResponse,
} from "@/lib/types/domain/registration";

type RegistrationInsert = InferInsertModel<typeof registrations>;

export async function upsertRegistration(params: RegistrationInsert) {
  const { domainId, nameservers, rawResponse, ...rest } = params;

  // Normalize nameserver hosts (trim + lowercase)
  // Filter out any nameservers with missing/invalid host values
  const normalizedNameservers: RegistrationNameserver[] = (nameservers ?? [])
    .filter((n) => n?.host && typeof n.host === "string")
    .map((n) => ({
      host: n.host.trim().toLowerCase(),
      ipv4: n.ipv4 ?? [],
      ipv6: n.ipv6 ?? [],
    }));

  const insertRow = {
    domainId,
    nameservers: normalizedNameservers,
    rawResponse,
    ...rest,
  };
  const updateRow = {
    nameservers: normalizedNameservers,
    rawResponse,
    ...rest,
  };

  await db.insert(registrations).values(insertRow).onConflictDoUpdate({
    target: registrations.domainId,
    set: updateRow,
  });
}

/**
 * Get cached registration data for a domain if fresh.
 * Returns null if cache miss or stale.
 */
export async function getRegistrationCached(
  domain: string,
): Promise<RegistrationResponse | null> {
  const now = new Date();

  const existing = await db
    .select({
      domainId: domains.id,
      domainName: domains.name,
      domainTld: domains.tld,
      domainUnicodeName: domains.unicodeName,
      registration: registrations,
      providerId: providers.id,
      providerName: providers.name,
      providerDomain: providers.domain,
    })
    .from(domains)
    .innerJoin(registrations, eq(registrations.domainId, domains.id))
    .leftJoin(providers, eq(registrations.registrarProviderId, providers.id))
    .where(eq(domains.name, domain))
    .limit(1);

  if (!existing[0] || existing[0].registration.expiresAt <= now) {
    return null;
  }

  const [row] = existing;

  const registrarProvider = row.providerName
    ? {
        id: row.providerId ?? null,
        name: row.providerName,
        domain: row.providerDomain ?? null,
      }
    : {
        id: null,
        name: null as string | null,
        domain: null as string | null,
      };

  const contactsArray: RegistrationContact[] = row.registration.contacts ?? [];
  const nameserversArray = row.registration.nameservers ?? [];

  const response: RegistrationResponse = {
    domainId: row.domainId,
    domain,
    tld: row.domainTld,
    isRegistered: row.registration.isRegistered,
    status: row.registration.isRegistered ? "registered" : "unregistered",
    unavailableReason: undefined,
    privacyEnabled: row.registration.privacyEnabled ?? false,
    unicodeName: row.domainUnicodeName,
    punycodeName: row.domainName,
    registry: row.registration.registry ?? undefined,
    statuses: row.registration.statuses ?? undefined,
    creationDate: row.registration.creationDate?.toISOString(),
    updatedDate: row.registration.updatedDate?.toISOString(),
    expirationDate: row.registration.expirationDate?.toISOString(),
    deletionDate: row.registration.deletionDate?.toISOString(),
    transferLock: row.registration.transferLock ?? undefined,
    nameservers: nameserversArray.length > 0 ? nameserversArray : undefined,
    contacts: contactsArray,
    whoisServer: row.registration.whoisServer ?? undefined,
    rdapServers: row.registration.rdapServers ?? undefined,
    source: row.registration.source ?? null,
    registrarProvider,
    rawResponse: formatRawResponseFromDb(
      row.registration.rawResponse,
      row.registration.source,
    ),
  };

  return response;
}

/**
 * Format raw response from database for display.
 * RDAP (object) is pretty-printed to JSON, WHOIS (string) is returned as-is.
 */
function formatRawResponseFromDb(
  rawResponse: unknown,
  source: "rdap" | "whois" | null,
): string | undefined {
  if (!rawResponse) return undefined;

  // WHOIS is stored as a string
  if (typeof rawResponse === "string") {
    return rawResponse;
  }

  // RDAP is stored as a JSON object - pretty print it
  if (source === "rdap" && typeof rawResponse === "object") {
    return JSON.stringify(rawResponse, null, 2);
  }

  // Fallback: stringify whatever we have
  return JSON.stringify(rawResponse, null, 2);
}

import "server-only";
import type { InferInsertModel } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { registrations } from "@/lib/db/schema";
import {
  RegistrationInsert as RegistrationInsertSchema,
  RegistrationUpdate as RegistrationUpdateSchema,
} from "@/lib/db/zod";
import { ns, redis } from "@/lib/redis";
import type { RegistrationNameservers } from "@/lib/schemas";

type RegistrationInsert = InferInsertModel<typeof registrations>;

export async function upsertRegistration(params: RegistrationInsert) {
  const { domainId, nameservers, ...rest } = params;

  // Normalize nameserver hosts (trim + lowercase)
  const normalizedNameservers: RegistrationNameservers = (
    nameservers ?? []
  ).map((n) => ({
    host: n.host.trim().toLowerCase(),
    ipv4: n.ipv4 ?? [],
    ipv6: n.ipv6 ?? [],
  }));

  const insertRow = RegistrationInsertSchema.parse({
    domainId,
    nameservers: normalizedNameservers,
    ...rest,
  });
  const updateRow = RegistrationUpdateSchema.parse({
    nameservers: normalizedNameservers,
    ...rest,
  });

  await db.insert(registrations).values(insertRow).onConflictDoUpdate({
    target: registrations.domainId,
    set: updateRow,
  });
}

/**
 * Build the Redis cache key for registration status.
 * This helper ensures consistent key format across the codebase.
 * Normalizes domain by trimming whitespace, removing trailing dots, and lowercasing.
 */
export function getRegistrationCacheKey(domain: string): string {
  // Normalize: trim whitespace, remove trailing dots, then lowercase
  const normalized = (domain || "").trim().replace(/\.+$/, "").toLowerCase();
  return ns("reg", normalized);
}

/**
 * Get cached registration status from Redis.
 * Returns true if registered, false if unregistered, null on cache miss or error.
 */
export async function getRegistrationStatusFromCache(
  domain: string,
): Promise<boolean | null> {
  try {
    const key = getRegistrationCacheKey(domain);
    const value = await redis.get<string>(key);
    if (value === "1") return true;
    if (value === "0") return false;
    return null;
  } catch (err) {
    // Redis failures should not break the flow; log and return null to fall back
    console.warn(
      `[redis] getRegistrationStatusFromCache failed for ${domain}`,
      err instanceof Error ? err : new Error(String(err)),
    );
    return null;
  }
}

/**
 * Set registration status in Redis with TTL.
 */
export async function setRegistrationStatusInCache(
  domain: string,
  isRegistered: boolean,
  ttlSeconds: number,
): Promise<void> {
  // Validate TTL before writing to Redis
  if (
    !Number.isFinite(ttlSeconds) ||
    !Number.isInteger(ttlSeconds) ||
    ttlSeconds <= 0
  ) {
    console.warn(
      `[redis] setRegistrationStatusInCache skipped for ${domain}: invalid TTL ${ttlSeconds}`,
    );
    return;
  }

  try {
    const key = getRegistrationCacheKey(domain);
    const value = isRegistered ? "1" : "0";
    await redis.setex(key, ttlSeconds, value);
  } catch (err) {
    // Log but don't throw; Redis cache failures should not break the flow
    console.warn(
      `[redis] setRegistrationStatusInCache failed for ${domain}`,
      err instanceof Error ? err : new Error(String(err)),
    );
  }
}

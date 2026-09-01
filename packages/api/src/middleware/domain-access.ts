import { updateLastAccessed } from "@domainstack/db/queries";

import { t } from "../trpc";
import { scheduleBackground } from "../wait-until";

function extractDomain(value: unknown): string | null {
  if (value && typeof value === "object" && "domain" in value && typeof value.domain === "string") {
    return value.domain;
  }
  return null;
}

/**
 * Middleware to record that a domain was accessed by a user (for decay calculation).
 * Expects input to have a `domain` field.
 * Schedules the write after the response is sent (or immediately outside a request).
 *
 * Prefer attaching this after `.input()` so `input` is the parsed/transformed
 * value. When it is attached before the parser (tRPC default builder order),
 * fall back to `getRawInput()` so the write still runs.
 */
export const withDomainAccessUpdate = t.middleware(async ({ input, next, getRawInput }) => {
  const result = await next();

  if (!result.ok) {
    return result;
  }

  const domain = extractDomain(input) ?? extractDomain(await getRawInput());
  if (domain) {
    await scheduleBackground(updateLastAccessed(domain));
  }

  return result;
});

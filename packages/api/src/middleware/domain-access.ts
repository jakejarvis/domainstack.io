import { waitUntil } from "@vercel/functions";

import { updateLastAccessed } from "@domainstack/db/queries";

import { t } from "../trpc";

/**
 * Middleware to record that a domain was accessed by a user (for decay calculation).
 * Expects input to have a `domain` field.
 * Schedules the write after the response is sent (or immediately outside a request).
 */
export const withDomainAccessUpdate = t.middleware(async ({ input, next }) => {
  const result = await next();

  // Only update access time for successful requests
  if (
    result.ok &&
    input &&
    typeof input === "object" &&
    "domain" in input &&
    typeof input.domain === "string"
  ) {
    // Extract to local const - closures don't preserve narrowed types
    const domain = input.domain;
    waitUntil(updateLastAccessed(domain));
  }

  return result;
});

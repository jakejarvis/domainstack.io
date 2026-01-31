import { updateLastAccessed } from "@domainstack/db/queries";
import { after } from "next/server";
import { t } from "../trpc";

/**
 * Middleware to record that a domain was accessed by a user (for decay calculation).
 * Expects input to have a `domain` field.
 * Schedules the write to happen after the response is sent using Next.js after().
 */
export const withDomainAccessUpdate = t.middleware(async ({ input, next }) => {
  // Check if input is a valid object with a domain property
  if (
    input &&
    typeof input === "object" &&
    "domain" in input &&
    typeof input.domain === "string"
  ) {
    after(() => updateLastAccessed(input.domain as string));
  }
  return next();
});

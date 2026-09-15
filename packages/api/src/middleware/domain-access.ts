import { waitUntil } from "@vercel/functions";

import { updateLastAccessed } from "@domainstack/db/queries/domains";
import { createLogger } from "@domainstack/logger";

import { t } from "../trpc";

const logger = createLogger({ source: "trpc/domain-access" });

interface DomainCandidate {
  domain?: unknown;
}

function extractDomain(candidate: DomainCandidate | null | undefined): string | null {
  if (typeof candidate?.domain === "string") {
    return candidate.domain;
  }
  return null;
}

/**
 * Middleware to record that a domain was accessed by a user (for decay calculation).
 * Expects input to have a `domain` field.
 * Schedules the write after the response is sent. `waitUntil` no-ops off-platform
 * (local dev, tests), where the write is skipped.
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

  const rawInput = await getRawInput();
  const parsedInput = input && typeof input === "object" ? (input as DomainCandidate) : undefined;
  const parsedRawInput =
    rawInput && typeof rawInput === "object" ? (rawInput as DomainCandidate) : undefined;
  const domain = extractDomain(parsedInput) ?? extractDomain(parsedRawInput);
  if (domain) {
    // `waitUntil` hands the promise to the platform rather than awaiting it, so a
    // rejection escaping here would surface as an unhandled rejection.
    waitUntil(
      (async () => {
        try {
          const updated = await updateLastAccessed(domain);
          if (!updated) {
            logger.debug({ domain }, "domain access record not found");
          }
        } catch (err: unknown) {
          logger.error({ err, domain }, "failed to record domain access");
        }
      })(),
    );
  }

  return result;
});

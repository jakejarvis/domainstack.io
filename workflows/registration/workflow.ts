import { FatalError, RetryableError } from "workflow";
import type { RegistrationResponse } from "@/lib/types";

export interface RegistrationWorkflowInput {
  domain: string;
}

export type RegistrationWorkflowResult =
  | {
      success: true;
      data: RegistrationResponse;
    }
  | {
      success: false;
      error: "unsupported_tld" | "timeout" | "lookup_failed";
      data: RegistrationResponse | null;
    };

// Internal types for step-to-step transfer
interface RdapLookupSuccess {
  success: true;
  recordJson: string;
}

interface RdapLookupFailure {
  success: false;
  error: "unsupported_tld" | "timeout" | "lookup_failed";
}

type RdapLookupResult = RdapLookupSuccess | RdapLookupFailure;

/**
 * Durable registration workflow that breaks down WHOIS/RDAP lookup into
 * independently retryable steps:
 * 1. Lookup via rdapper (WHOIS/RDAP - the slow operation)
 * 2. Normalize registrar provider
 * 3. Persist to database
 */
export async function registrationWorkflow(
  input: RegistrationWorkflowInput,
): Promise<RegistrationWorkflowResult> {
  "use workflow";

  const { domain } = input;

  // Step 1: Lookup via rdapper
  const rdapResult = await lookupWhoisStep(domain);

  if (!rdapResult.success) {
    // Build response for failed lookup
    const errorData = await buildErrorResponseStep(domain, rdapResult.error);
    return { success: false, error: rdapResult.error, data: errorData };
  }

  // Step 2: Normalize registrar and build response
  const normalizedResult = await normalizeAndBuildResponseStep(
    rdapResult.recordJson,
  );

  // Step 3: Persist to database (only for registered domains)
  let domainId: string | undefined;
  if (normalizedResult.isRegistered) {
    domainId = await persistRegistrationStep(
      domain,
      rdapResult.recordJson,
      normalizedResult,
    );
  }

  return {
    success: true,
    data: { ...normalizedResult, domainId },
  };
}

/**
 * Step: Lookup domain registration via rdapper (WHOIS/RDAP)
 */
async function lookupWhoisStep(domain: string): Promise<RdapLookupResult> {
  "use step";

  const { lookupRdap } = await import("@/lib/domain/registration-lookup");

  const result = await lookupRdap(domain);

  if (!result.success) {
    // Both retry and timeout should trigger retries
    if (result.error === "retry") {
      throw new RetryableError("RDAP lookup failed", { retryAfter: "5s" });
    }
    if (result.error === "timeout") {
      throw new RetryableError("RDAP lookup timed out", { retryAfter: "10s" });
    }
    // Unsupported TLD is a permanent failure
    return { success: false, error: "unsupported_tld" };
  }

  return result;
}

/**
 * Step: Build error response for failed lookups
 */
async function buildErrorResponseStep(
  domain: string,
  error: RdapLookupFailure["error"],
): Promise<RegistrationResponse> {
  "use step";

  const { buildErrorResponse } = await import(
    "@/lib/domain/registration-lookup"
  );
  return buildErrorResponse(domain, error);
}

/**
 * Step: Normalize registrar and build response
 */
async function normalizeAndBuildResponseStep(
  recordJson: string,
): Promise<RegistrationResponse> {
  "use step";

  const { normalizeRdapRecord } = await import(
    "@/lib/domain/registration-lookup"
  );
  return await normalizeRdapRecord(recordJson);
}

/**
 * Step: Persist registration to database
 */
async function persistRegistrationStep(
  domain: string,
  recordJson: string,
  response: RegistrationResponse,
): Promise<string> {
  "use step";

  const { persistRegistrationData } = await import(
    "@/lib/domain/registration-lookup"
  );
  const { createLogger } = await import("@/lib/logger/server");

  const logger = createLogger({ source: "registration-workflow" });

  try {
    return await persistRegistrationData(domain, recordJson, response);
  } catch (err) {
    logger.error({ err, domain }, "failed to persist registration");
    throw new FatalError("Failed to persist registration");
  }
}

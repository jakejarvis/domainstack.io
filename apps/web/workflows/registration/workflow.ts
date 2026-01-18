import type { RegistrationResponse } from "@/lib/types/domain/registration";
import type { WorkflowResult } from "@/lib/workflow/types";
import {
  lookupWhoisStep,
  normalizeAndBuildResponseStep,
  persistRegistrationStep,
  type RegistrationError,
} from "@/workflows/shared/registration";
import { scheduleRevalidationBatchStep } from "@/workflows/shared/revalidation/schedule-batch";

export interface RegistrationWorkflowInput {
  domain: string;
}

export type RegistrationWorkflowResult = WorkflowResult<
  RegistrationResponse,
  RegistrationError
>;

/**
 * Durable registration workflow that breaks down WHOIS/RDAP lookup into
 * independently retryable steps:
 * 1. Lookup via rdapper (WHOIS/RDAP - the slow operation)
 * 2. Normalize registrar provider
 * 3. Persist to database
 * 4. Schedule revalidation
 */
export async function registrationWorkflow(
  input: RegistrationWorkflowInput,
): Promise<RegistrationWorkflowResult> {
  "use workflow";

  const { domain } = input;

  // Step 1: Lookup via rdapper
  const rdapResult = await lookupWhoisStep(domain);

  if (!rdapResult.success) {
    return { success: false, error: rdapResult.error, data: null };
  }

  // Step 2: Normalize registrar and build response
  const normalizedResult = await normalizeAndBuildResponseStep(
    rdapResult.data.recordJson,
  );

  // Step 3: Persist to database (only for registered domains)
  let domainId: string | undefined;
  if (normalizedResult.isRegistered) {
    const { domainId: id, lastAccessedAt } = await persistRegistrationStep(
      domain,
      normalizedResult,
    );
    domainId = id;

    // Step 4: Schedule revalidation (only if we persisted)
    await scheduleRevalidationBatchStep(
      domain,
      ["registration"],
      lastAccessedAt,
    );
  }

  return {
    success: true,
    data: { ...normalizedResult, domainId },
  };
}

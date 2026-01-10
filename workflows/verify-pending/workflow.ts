import { FatalError } from "workflow";
import type { VerificationMethod } from "@/lib/constants/verification";
import { verifyDomainOwnership } from "@/workflows/shared/verify-domain";

export interface VerifyPendingWorkflowInput {
  trackedDomainId: string;
}

export type VerifyPendingWorkflowResult =
  | { skipped: true; reason: string }
  | { verified: true; method: VerificationMethod }
  | { verified: false };

/**
 * Durable workflow to verify a pending domain.
 *
 * Called by the scheduled cron job to verify pending domains
 * that haven't been manually verified by the user.
 */
export async function verifyPendingWorkflow(
  input: VerifyPendingWorkflowInput,
): Promise<VerifyPendingWorkflowResult> {
  "use workflow";

  const { trackedDomainId } = input;

  // Step 1: Fetch domain data
  const domain = await fetchDomain(trackedDomainId);

  if (!domain) {
    return { skipped: true, reason: "not_found" };
  }

  if (domain.verified) {
    return { skipped: true, reason: "already_verified" };
  }

  // Guard against missing verification token
  if (!domain.verificationToken) {
    return { skipped: true, reason: "missing_verification_token" };
  }

  // Step 2: Verify ownership
  const result = await verifyOwnership(
    domain.domainName,
    domain.verificationToken,
  );

  if (result.verified && result.method) {
    // Step 3: Mark as verified
    await markVerified(trackedDomainId, result.method);
    return { verified: true, method: result.method };
  }

  return { verified: false };
}

interface DomainData {
  domainName: string;
  verificationToken: string | null;
  verified: boolean;
}

async function fetchDomain(
  trackedDomainId: string,
): Promise<DomainData | null> {
  "use step";

  const { findTrackedDomainWithDomainName } = await import(
    "@/lib/db/repos/tracked-domains"
  );

  return await findTrackedDomainWithDomainName(trackedDomainId);
}

async function verifyOwnership(
  domainName: string,
  token: string,
): Promise<{ verified: boolean; method: VerificationMethod | null }> {
  "use step";

  // Call the shared verification step directly - no child workflow needed
  return await verifyDomainOwnership(domainName, token);
}

async function markVerified(
  trackedDomainId: string,
  method: VerificationMethod,
): Promise<void> {
  "use step";

  const { verifyTrackedDomain } = await import(
    "@/lib/db/repos/tracked-domains"
  );

  const result = await verifyTrackedDomain(trackedDomainId, method);
  if (!result) {
    // Domain doesn't exist or can't be updated - permanent failure, don't retry
    throw new FatalError(
      `Failed to mark domain as verified: trackedDomainId=${trackedDomainId}, method=${method}`,
    );
  }
}

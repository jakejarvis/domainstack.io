import { start } from "workflow/api";
import type { VerificationMethod } from "@/lib/types";
import { verificationWorkflow } from "@/workflows/verification";

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

  // Step 2: Verify ownership
  const result = await verifyOwnership(
    domain.domainName,
    domain.verificationToken,
  );

  if (result.success && result.data.verified && result.data.method) {
    // Step 3: Mark as verified
    const verifiedMethod = result.data.method;
    await markVerified(trackedDomainId, verifiedMethod);
    return { verified: true, method: verifiedMethod };
  }

  return { verified: false };
}

interface DomainData {
  domainName: string;
  verificationToken: string;
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
): Promise<{
  success: boolean;
  data: { verified: boolean; method: VerificationMethod | null };
}> {
  "use step";

  const workflowRun = await start(verificationWorkflow, [
    { domain: domainName, token },
  ]);
  return await workflowRun.returnValue;
}

async function markVerified(
  trackedDomainId: string,
  method: VerificationMethod,
): Promise<void> {
  "use step";

  const { verifyTrackedDomain } = await import(
    "@/lib/db/repos/tracked-domains"
  );

  await verifyTrackedDomain(trackedDomainId, method);
}

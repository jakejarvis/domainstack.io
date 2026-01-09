import { sleep } from "workflow";
import { start } from "workflow/api";
import type { VerificationMethod } from "@/lib/types";
import { verificationWorkflow } from "@/workflows/verification";

export interface AutoVerifyWorkflowInput {
  trackedDomainId: string;
  domainName: string;
}

export type AutoVerifyWorkflowResult =
  | {
      result: "verified";
      domainName: string;
      verifiedMethod: VerificationMethod;
      attempt: number;
    }
  | { result: "cancelled"; reason: "domain_deleted" | "already_verified" }
  | { result: "exhausted"; message: string };

/**
 * Retry schedule for auto-verification attempts.
 * Front-loads checks when DNS propagation is most likely to have completed.
 *
 * Schedule: 1min → 3min → 10min → 30min → 1hr (then stop)
 * Total time covered: ~2 hours
 *
 * After this, the daily cron job will catch any stragglers.
 */
const RETRY_DELAYS_MS = [
  60 * 1000, // 1 minute
  3 * 60 * 1000, // 3 minutes
  10 * 60 * 1000, // 10 minutes
  30 * 60 * 1000, // 30 minutes
  60 * 60 * 1000, // 1 hour
] as const;

/**
 * Durable workflow to auto-verify a pending domain.
 *
 * Uses sleep steps to implement a smart retry schedule that:
 * - Checks frequently at first (when verification is most likely to succeed)
 * - Backs off over time to avoid unnecessary checks
 * - Stops after ~2 hours (daily cron catches stragglers)
 */
export async function autoVerifyWorkflow(
  input: AutoVerifyWorkflowInput,
): Promise<AutoVerifyWorkflowResult> {
  "use workflow";

  const { trackedDomainId } = input;

  for (let attempt = 0; attempt < RETRY_DELAYS_MS.length; attempt++) {
    const delayMs = RETRY_DELAYS_MS[attempt];

    // Wait before checking (gives DNS time to propagate)
    await sleep(delayMs);

    // Check if the domain is still pending and fetch latest verification inputs
    const tracked = await checkDomainStatus(trackedDomainId);

    // If domain was deleted or already verified, stop the schedule
    if (tracked.status === "deleted") {
      return { result: "cancelled", reason: "domain_deleted" };
    }

    if (tracked.status === "already-verified") {
      return { result: "cancelled", reason: "already_verified" };
    }

    // Attempt verification using fresh values from DB
    const { domainName: currentDomainName, verificationToken } = tracked;

    // Defensive check: skip if token is missing
    if (!verificationToken) {
      continue;
    }

    const result = await attemptVerification(
      attempt,
      currentDomainName,
      verificationToken,
    );

    if (result.verified && result.method) {
      // Success! Mark the domain as verified
      await markVerified(attempt, trackedDomainId, result.method);

      return {
        result: "verified",
        domainName: currentDomainName,
        verifiedMethod: result.method,
        attempt: attempt + 1,
      };
    }
  }

  // All attempts exhausted - daily cron will catch it
  return {
    result: "exhausted",
    message: "Verification schedule complete. Daily cron will retry.",
  };
}

type DomainStatus =
  | { status: "deleted" }
  | { status: "already-verified"; domainName: string }
  | { status: "pending"; domainName: string; verificationToken: string };

async function checkDomainStatus(
  trackedDomainId: string,
): Promise<DomainStatus> {
  "use step";

  const { findTrackedDomainWithDomainName } = await import(
    "@/lib/db/repos/tracked-domains"
  );

  const domain = await findTrackedDomainWithDomainName(trackedDomainId);

  if (!domain) {
    return { status: "deleted" };
  }

  if (domain.verified) {
    return { status: "already-verified", domainName: domain.domainName };
  }

  return {
    status: "pending",
    domainName: domain.domainName,
    verificationToken: domain.verificationToken,
  };
}

async function attemptVerification(
  _attempt: number,
  domainName: string,
  token: string,
): Promise<{ verified: boolean; method: VerificationMethod | null }> {
  "use step";

  const workflowRun = await start(verificationWorkflow, [
    { domain: domainName, token },
  ]);
  const result = await workflowRun.returnValue;

  if (result.success && result.data.verified && result.data.method) {
    return { verified: true, method: result.data.method };
  }

  return { verified: false, method: null };
}

async function markVerified(
  _attempt: number,
  trackedDomainId: string,
  method: VerificationMethod,
): Promise<void> {
  "use step";

  const { verifyTrackedDomain } = await import(
    "@/lib/db/repos/tracked-domains"
  );

  await verifyTrackedDomain(trackedDomainId, method);
}

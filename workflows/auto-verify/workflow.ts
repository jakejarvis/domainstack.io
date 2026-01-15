import { FatalError, sleep } from "workflow";
import type { VerificationMethod } from "@/lib/constants/verification";
import {
  verifyDomainByDns,
  verifyDomainByHtmlFile,
  verifyDomainByMetaTag,
} from "@/workflows/shared/verify-domain";

export interface AutoVerifyWorkflowInput {
  trackedDomainId: string;
  /** @deprecated Not used - domain name is fetched from database */
  domainName?: string;
}

export type AutoVerifyWorkflowResult =
  | {
      result: "verified";
      trackedDomainId: string;
      domainId: string;
      domainName: string;
      verifiedMethod: VerificationMethod;
      attempt: number;
    }
  | { result: "cancelled"; reason: "domain_deleted" | "already_verified" }
  | { result: "exhausted"; message: string };

/**
 * Retry schedule for auto-verification attempts.
 * Front-loads checks when DNS propagation is most likely to have completed,
 * then continues with daily checks for domains that take longer to verify.
 *
 * Schedule:
 * - Quick checks: 1min → 3min → 10min → 30min → 1hr
 * - Daily checks: Day 1 → Day 2 → Day 3 → Day 5 → Day 7 → Day 10 → Day 14 → Day 21 → Day 30
 *
 * Total time covered: ~30 days
 */
const RETRY_DELAYS_MS = [
  // Quick checks (first ~2 hours)
  60 * 1000, // 1 minute
  3 * 60 * 1000, // 3 minutes
  10 * 60 * 1000, // 10 minutes
  30 * 60 * 1000, // 30 minutes
  60 * 60 * 1000, // 1 hour
  // Daily checks (for domains that take longer)
  24 * 60 * 60 * 1000, // Day 1
  24 * 60 * 60 * 1000, // Day 2
  24 * 60 * 60 * 1000, // Day 3
  2 * 24 * 60 * 60 * 1000, // Day 5 (skip day 4)
  2 * 24 * 60 * 60 * 1000, // Day 7 (skip day 6)
  3 * 24 * 60 * 60 * 1000, // Day 10 (skip days 8-9)
  4 * 24 * 60 * 60 * 1000, // Day 14 (skip days 11-13)
  7 * 24 * 60 * 60 * 1000, // Day 21 (skip days 15-20)
  9 * 24 * 60 * 60 * 1000, // Day 30 (skip days 22-29)
] as const;

/**
 * Durable workflow to auto-verify a pending domain.
 *
 * Uses sleep steps to implement a smart retry schedule that:
 * - Checks frequently at first (when verification is most likely to succeed)
 * - Backs off to daily checks for domains that take longer
 * - Continues checking for up to 30 days
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
      currentDomainName,
      verificationToken,
    );

    if (result.verified && result.method) {
      // Success! Mark the domain as verified
      const verified = await markVerified(trackedDomainId, result.method);

      return {
        result: "verified",
        trackedDomainId: verified.trackedDomainId,
        domainId: verified.domainId,
        domainName: currentDomainName,
        verifiedMethod: result.method,
        attempt: attempt + 1,
      };
    }
  }

  // All attempts exhausted after 30 days
  return {
    result: "exhausted",
    message:
      "Verification schedule complete after 30 days. Domain remains unverified.",
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
  domainName: string,
  token: string,
): Promise<{ verified: boolean; method: VerificationMethod | null }> {
  "use workflow step";

  // Try DNS first (most reliable)
  const dnsResult = await verifyDomainByDns(domainName, token);
  if (dnsResult.verified) return dnsResult;

  // Try HTML file
  const htmlResult = await verifyDomainByHtmlFile(domainName, token);
  if (htmlResult.verified) return htmlResult;

  // Try meta tag
  const metaResult = await verifyDomainByMetaTag(domainName, token);
  if (metaResult.verified) return metaResult;

  return { verified: false, method: null };
}

async function markVerified(
  trackedDomainId: string,
  method: VerificationMethod,
): Promise<{ trackedDomainId: string; domainId: string }> {
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

  return {
    trackedDomainId: result.id,
    domainId: result.domainId,
  };
}

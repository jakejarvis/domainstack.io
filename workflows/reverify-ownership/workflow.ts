import { getWorkflowMetadata } from "workflow";
import { start } from "workflow/api";
import type { VerificationMethod } from "@/lib/types";
import { verificationWorkflow } from "@/workflows/verification";

export interface ReverifyOwnershipWorkflowInput {
  trackedDomainId: string;
}

type VerificationFailureAction =
  | "marked_failing"
  | "revoked"
  | "in_grace_period";

export type ReverifyOwnershipWorkflowResult =
  | { skipped: true; reason: string }
  | { verified: true; method: VerificationMethod }
  | { verified: false; action: VerificationFailureAction };

/**
 * Durable workflow to re-verify domain ownership.
 *
 * Checks if a verified domain still passes verification and handles
 * failures with a grace period before revoking verification.
 */
export async function reverifyOwnershipWorkflow(
  input: ReverifyOwnershipWorkflowInput,
): Promise<ReverifyOwnershipWorkflowResult> {
  "use workflow";

  const { trackedDomainId } = input;

  // Step 1: Fetch domain data
  const domain = await fetchDomain(trackedDomainId);

  if (!domain) {
    return { skipped: true, reason: "invalid_state" };
  }

  // Step 2: Check ownership using the existing verification method
  const result = await checkOwnership(
    domain.domainName,
    domain.verificationToken,
    domain.verificationMethod,
  );

  if (result.success && result.data.verified) {
    // Step 3a: Mark as successful
    await markSuccess(trackedDomainId);
    return { verified: true, method: result.data.method as VerificationMethod };
  }

  // Step 3b: Handle failure
  const action = await handleFailure({
    id: domain.id,
    domainName: domain.domainName,
    userId: domain.userId,
    userName: domain.userName,
    userEmail: domain.userEmail,
    verificationStatus: domain.verificationStatus,
    verificationMethod: domain.verificationMethod,
    verificationFailedAt: domain.verificationFailedAt
      ? new Date(domain.verificationFailedAt)
      : null,
  });

  return { verified: false, action };
}

interface DomainData {
  id: string;
  domainName: string;
  userId: string;
  userName: string;
  userEmail: string;
  verificationToken: string;
  verificationMethod: VerificationMethod;
  verificationStatus: "verified" | "failing" | "unverified";
  verificationFailedAt: Date | null;
}

async function fetchDomain(
  trackedDomainId: string,
): Promise<DomainData | null> {
  "use step";

  const { getTrackedDomainForReverification } = await import(
    "@/lib/db/repos/tracked-domains"
  );

  return await getTrackedDomainForReverification(trackedDomainId);
}

async function checkOwnership(
  domainName: string,
  token: string,
  method: VerificationMethod,
): Promise<{
  success: boolean;
  data: { verified: boolean; method: VerificationMethod | null };
}> {
  "use step";

  const workflowRun = await start(verificationWorkflow, [
    { domain: domainName, token, method },
  ]);
  return await workflowRun.returnValue;
}

async function markSuccess(trackedDomainId: string): Promise<void> {
  "use step";

  const { markVerificationSuccessful } = await import(
    "@/lib/db/repos/tracked-domains"
  );

  await markVerificationSuccessful(trackedDomainId);
}

interface DomainForFailureHandling {
  id: string;
  domainName: string;
  userId: string;
  userName: string;
  userEmail: string;
  verificationStatus: "verified" | "failing" | "unverified";
  verificationMethod: VerificationMethod;
  verificationFailedAt: Date | null;
}

async function handleFailure(
  domain: DomainForFailureHandling,
): Promise<VerificationFailureAction> {
  "use step";

  const { differenceInDays: diffInDays } = await import("date-fns");
  const { VERIFICATION_GRACE_PERIOD_DAYS } = await import(
    "@/lib/constants/verification"
  );
  const { markVerificationFailing, revokeVerification } = await import(
    "@/lib/db/repos/tracked-domains"
  );

  const now = new Date();

  if (domain.verificationStatus === "verified") {
    // First failure - mark as failing and send warning
    await markVerificationFailing(domain.id);
    await sendVerificationFailingEmail(domain);
    return "marked_failing";
  }

  if (domain.verificationStatus === "failing") {
    // Already failing - check if grace period exceeded
    const failedAt = domain.verificationFailedAt;
    if (!failedAt) {
      // Shouldn't happen, but mark failing time now
      await markVerificationFailing(domain.id);
      return "marked_failing";
    }

    const daysFailing = diffInDays(now, failedAt);

    if (daysFailing >= VERIFICATION_GRACE_PERIOD_DAYS) {
      // Grace period exceeded - revoke verification
      await revokeVerification(domain.id);
      await sendVerificationRevokedEmail(domain);
      return "revoked";
    }

    return "in_grace_period";
  }

  return "in_grace_period";
}

// Note: Not a step function - called from within handleFailure step
async function sendVerificationFailingEmail(
  domain: DomainForFailureHandling,
): Promise<boolean> {
  const { VerificationFailingEmail } = await import(
    "@/emails/verification-failing"
  );
  const { VERIFICATION_GRACE_PERIOD_DAYS } = await import(
    "@/lib/constants/verification"
  );
  const {
    createNotification,
    hasRecentNotification,
    updateNotificationResendId,
  } = await import("@/lib/db/repos/notifications");
  const { sendPrettyEmail } = await import("@/lib/resend");
  const { createLogger } = await import("@/lib/logger/server");

  const logger = createLogger({ source: "reverify-ownership-workflow" });

  const alreadySent = await hasRecentNotification(
    domain.id,
    "verification_failing",
  );
  if (alreadySent) return false;

  // Use workflow run ID as idempotency key - ensures exactly-once delivery
  const { workflowRunId } = getWorkflowMetadata();

  const title = `Verification failing for ${domain.domainName}`;
  const subject = `⚠️ ${title}`;
  const message = `Verification for ${domain.domainName} is failing. You have ${VERIFICATION_GRACE_PERIOD_DAYS} days to fix it before access is revoked.`;

  try {
    // Create in-app notification first
    const notification = await createNotification({
      userId: domain.userId,
      trackedDomainId: domain.id,
      type: "verification_failing",
      title,
      message,
      data: { domainName: domain.domainName },
    });

    if (!notification) {
      logger.error(
        {
          trackedDomainId: domain.id,
          notificationType: "verification_failing",
          domainName: domain.domainName,
        },
        "Failed to create notification record",
      );
      throw new Error("Failed to create notification record in database");
    }

    // Send email notification
    const { data, error } = await sendPrettyEmail(
      {
        to: domain.userEmail,
        subject,
        react: VerificationFailingEmail({
          userName: domain.userName.split(" ")[0] || "there",
          domainName: domain.domainName,
          verificationMethod: domain.verificationMethod,
          gracePeriodDays: VERIFICATION_GRACE_PERIOD_DAYS,
        }),
      },
      { idempotencyKey: workflowRunId },
    );

    if (error) throw new Error(`Resend error: ${error.message}`);

    // Update notification with email ID
    if (data?.id) {
      await updateNotificationResendId(notification.id, data.id);
    }

    return true;
  } catch (err) {
    logger.error(
      {
        err,
        domainName: domain.domainName,
        userId: domain.userId,
        workflowRunId,
      },
      "Error sending verification failing email",
    );
    throw err;
  }
}

// Note: Not a step function - called from within handleFailure step
async function sendVerificationRevokedEmail(
  domain: DomainForFailureHandling,
): Promise<boolean> {
  const { VerificationRevokedEmail } = await import(
    "@/emails/verification-revoked"
  );
  const {
    createNotification,
    hasRecentNotification,
    updateNotificationResendId,
  } = await import("@/lib/db/repos/notifications");
  const { sendPrettyEmail } = await import("@/lib/resend");
  const { createLogger } = await import("@/lib/logger/server");

  const logger = createLogger({ source: "reverify-ownership-workflow" });

  const alreadySent = await hasRecentNotification(
    domain.id,
    "verification_revoked",
  );
  if (alreadySent) return false;

  // Use workflow run ID as idempotency key - ensures exactly-once delivery
  const { workflowRunId } = getWorkflowMetadata();

  const title = `Verification revoked for ${domain.domainName}`;
  const subject = `❌ ${title}`;
  const message = `Verification for ${domain.domainName} has been revoked. The grace period has expired without successful re-verification.`;

  try {
    // Create in-app notification first
    const notification = await createNotification({
      userId: domain.userId,
      trackedDomainId: domain.id,
      type: "verification_revoked",
      title,
      message,
      data: { domainName: domain.domainName },
    });

    if (!notification) {
      logger.error(
        {
          trackedDomainId: domain.id,
          notificationType: "verification_revoked",
          domainName: domain.domainName,
        },
        "Failed to create notification record",
      );
      throw new Error("Failed to create notification record in database");
    }

    // Send email notification
    const { data, error } = await sendPrettyEmail(
      {
        to: domain.userEmail,
        subject,
        react: VerificationRevokedEmail({
          userName: domain.userName.split(" ")[0] || "there",
          domainName: domain.domainName,
        }),
      },
      { idempotencyKey: workflowRunId },
    );

    if (error) throw new Error(`Resend error: ${error.message}`);

    // Update notification with email ID
    if (data?.id) {
      await updateNotificationResendId(notification.id, data.id);
    }

    return true;
  } catch (err) {
    logger.error(
      {
        err,
        domainName: domain.domainName,
        userId: domain.userId,
        workflowRunId,
      },
      "Error sending verification revoked email",
    );
    throw err;
  }
}

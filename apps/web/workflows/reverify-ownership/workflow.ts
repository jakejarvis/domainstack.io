import { FatalError } from "workflow";

import { verifyDomainOwnershipByMethod } from "@/workflows/shared/verify-domain";
import type { TrackedDomainForReverification } from "@domainstack/db/queries/tracked-domains";
import type { VerificationMethod } from "@domainstack/types";

interface ReverifyOwnershipWorkflowInput {
  trackedDomainId: string;
}

type VerificationFailureAction = "marked_failing" | "revoked" | "in_grace_period";

type ReverifyOwnershipWorkflowResult =
  | { skipped: true; reason: "invalid_state" }
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
  const result = await verifyDomainOwnershipByMethod(
    domain.domainName,
    domain.verificationToken,
    domain.verificationMethod,
  );

  if (result.verified && result.method) {
    // Step 3a: Mark as successful
    await markSuccess(trackedDomainId);
    return { verified: true, method: result.method };
  }

  // Step 3b: Determine failure action (database update only)
  const failureResult = await determineFailureAction({
    id: domain.id,
    verificationStatus: domain.verificationStatus,
    verificationFailedAt: domain.verificationFailedAt,
  });

  // Step 4: Send notification email based on the action (separate steps for retry isolation)
  if (failureResult.shouldSendEmail) {
    if (failureResult.emailType === "failing") {
      await sendVerificationFailingEmail({
        id: domain.id,
        domainName: domain.domainName,
        userId: domain.userId,
        userName: domain.userName,
        userEmail: domain.userEmail,
        verificationMethod: domain.verificationMethod,
      });
    } else {
      await sendVerificationRevokedEmail({
        id: domain.id,
        domainName: domain.domainName,
        userId: domain.userId,
        userName: domain.userName,
        userEmail: domain.userEmail,
        verificationMethod: domain.verificationMethod,
      });
    }
  }

  return { verified: false, action: failureResult.action };
}

type DomainData = Pick<
  TrackedDomainForReverification,
  | "id"
  | "domainName"
  | "userId"
  | "userName"
  | "userEmail"
  | "verificationToken"
  | "verificationMethod"
  | "verificationStatus"
  | "verificationFailedAt"
>;

async function fetchDomain(trackedDomainId: string): Promise<DomainData | null> {
  "use step";

  const { getTrackedDomainForReverification } =
    await import("@domainstack/db/queries/tracked-domains");

  const domain = await getTrackedDomainForReverification(trackedDomainId);
  if (!domain) return null;

  return {
    id: domain.id,
    domainName: domain.domainName,
    userId: domain.userId,
    userName: domain.userName,
    userEmail: domain.userEmail,
    verificationToken: domain.verificationToken,
    verificationMethod: domain.verificationMethod,
    verificationStatus: domain.verificationStatus,
    verificationFailedAt: domain.verificationFailedAt,
  };
}

async function markSuccess(trackedDomainId: string): Promise<void> {
  "use step";

  const { markVerificationSuccessful } = await import("@domainstack/db/queries/tracked-domains");

  await markVerificationSuccessful(trackedDomainId);
}

type DomainForFailureCheck = Pick<DomainData, "id" | "verificationStatus" | "verificationFailedAt">;

type FailureActionResult =
  | { action: "marked_failing"; shouldSendEmail: boolean; emailType: "failing" }
  | { action: "revoked"; shouldSendEmail: true; emailType: "revoked" }
  | { action: "in_grace_period"; shouldSendEmail: false; emailType: "failing" };

/**
 * Determines the failure action and updates database state.
 * Does NOT send emails - that's handled in a separate step for proper isolation.
 */
async function determineFailureAction(domain: DomainForFailureCheck): Promise<FailureActionResult> {
  "use step";

  const { calculateDaysElapsed } = await import("@domainstack/utils/expiry");
  const { VERIFICATION_GRACE_PERIOD_DAYS } = await import("@domainstack/constants");
  const { markVerificationFailing, revokeVerification } =
    await import("@domainstack/db/queries/tracked-domains");

  const now = new Date();

  if (domain.verificationStatus === "verified") {
    // First failure - mark as failing
    await markVerificationFailing(domain.id);
    return {
      action: "marked_failing",
      shouldSendEmail: true,
      emailType: "failing",
    };
  }

  if (domain.verificationStatus === "failing") {
    // Already failing - check if grace period exceeded
    const failedAt = domain.verificationFailedAt;
    if (!failedAt) {
      // Shouldn't happen, but mark failing time now
      await markVerificationFailing(domain.id);
      return {
        action: "marked_failing",
        shouldSendEmail: false,
        emailType: "failing",
      };
    }

    const daysFailing = calculateDaysElapsed(failedAt, now);

    if (daysFailing >= VERIFICATION_GRACE_PERIOD_DAYS) {
      // Grace period exceeded - revoke verification
      await revokeVerification(domain.id);
      return {
        action: "revoked",
        shouldSendEmail: true,
        emailType: "revoked",
      };
    }

    return {
      action: "in_grace_period",
      shouldSendEmail: false,
      emailType: "failing",
    };
  }

  return {
    action: "in_grace_period",
    shouldSendEmail: false,
    emailType: "failing",
  };
}

type DomainForEmail = Pick<
  DomainData,
  "id" | "domainName" | "userId" | "userName" | "userEmail" | "verificationMethod"
>;

/**
 * Step: Send verification failing notification email.
 *
 * Sends before recording. The whole step body re-runs on retry, so writing the
 * notification row first would make the `hasRecentNotification` guard match the
 * row from the failed attempt and swallow the email for the next 30 days while
 * the database claimed it was sent. Resend's idempotency key (the enclosing
 * step id) keeps a retry from delivering the mail twice.
 */
async function sendVerificationFailingEmail(domain: DomainForEmail): Promise<void> {
  "use step";

  const { default: VerificationFailingEmail } =
    await import("@domainstack/email/templates/verification-failing");
  const { VERIFICATION_GRACE_PERIOD_DAYS } = await import("@domainstack/constants");
  const { hasRecentNotification, createNotification, updateNotificationResendId } =
    await import("@domainstack/db/queries/notifications");
  const { getEmailBaseUrl, sendEmail } = await import("@/workflows/shared/send-email");

  const alreadySent = await hasRecentNotification(domain.id, "verification_failing");
  if (alreadySent) return;

  const title = `Verification failing for ${domain.domainName}`;
  const subject = `⚠️ ${title}`;
  const message = `Verification for ${domain.domainName} is failing. You have ${VERIFICATION_GRACE_PERIOD_DAYS} days to fix it before access is revoked.`;

  const baseUrl = getEmailBaseUrl();

  // Send email through the shared in-step helper (handles error classification).
  const result = await sendEmail({
    to: domain.userEmail,
    subject,
    react: VerificationFailingEmail({
      userName: domain.userName.split(" ")[0] || "there",
      domainName: domain.domainName,
      verificationMethod: domain.verificationMethod,
      gracePeriodDays: VERIFICATION_GRACE_PERIOD_DAYS,
      baseUrl,
    }),
  });

  // Record the delivery. `updateNotificationResendId` swallows its own errors,
  // so nothing after the send can fail the step and trigger a re-send.
  const notification = await createNotification({
    userId: domain.userId,
    trackedDomainId: domain.id,
    type: "verification_failing",
    title,
    message,
    data: { domainName: domain.domainName },
  });

  if (!notification) {
    throw new FatalError(
      `Failed to create notification record: verification_failing for ${domain.domainName}`,
    );
  }

  await updateNotificationResendId(notification.id, result.emailId);
}

/**
 * Step: Send verification revoked notification email.
 *
 * Sends before recording, for the same reason as
 * {@link sendVerificationFailingEmail}.
 */
async function sendVerificationRevokedEmail(domain: DomainForEmail): Promise<void> {
  "use step";

  const { default: VerificationRevokedEmail } =
    await import("@domainstack/email/templates/verification-revoked");
  const { hasRecentNotification, createNotification, updateNotificationResendId } =
    await import("@domainstack/db/queries/notifications");
  const { getEmailBaseUrl, sendEmail } = await import("@/workflows/shared/send-email");

  const alreadySent = await hasRecentNotification(domain.id, "verification_revoked");
  if (alreadySent) return;

  const title = `Verification revoked for ${domain.domainName}`;
  const subject = `❌ ${title}`;
  const message = `Verification for ${domain.domainName} has been revoked. The grace period has expired without successful re-verification.`;

  const baseUrl = getEmailBaseUrl();

  // Send email through the shared in-step helper (handles error classification).
  const result = await sendEmail({
    to: domain.userEmail,
    subject,
    react: VerificationRevokedEmail({
      userName: domain.userName.split(" ")[0] || "there",
      domainName: domain.domainName,
      baseUrl,
    }),
  });

  const notification = await createNotification({
    userId: domain.userId,
    trackedDomainId: domain.id,
    type: "verification_revoked",
    title,
    message,
    data: { domainName: domain.domainName },
  });

  if (!notification) {
    throw new FatalError(
      `Failed to create notification record: verification_revoked for ${domain.domainName}`,
    );
  }

  await updateNotificationResendId(notification.id, result.emailId);
}

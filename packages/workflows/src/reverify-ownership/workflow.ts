import type { TrackedDomainForReverification } from "@domainstack/db/queries/tracked-domains";
import type { VerificationMethod } from "@domainstack/types";

import { verifyDomainOwnershipByMethod } from "../steps/verification";

interface ReverifyOwnershipWorkflowInput {
  trackedDomainId: string;
}

type VerificationFailureAction = "marked_failing" | "revoked" | "in_grace_period";

type ReverifyOwnershipWorkflowResult =
  | { skipped: true; reason: "invalid_state" | "check_failed" }
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

  if (
    result.checkFailed &&
    (domain.verificationStatus !== "failing" || !domain.verificationFailedAt)
  ) {
    // The probe itself couldn't complete — not a confirmed absence — so
    // don't start a new grace-period episode on network noise. But once a
    // grace period is already running, don't let a chronically-broken probe
    // freeze it forever either: fall through so it keeps progressing.
    await logCheckFailedSkip(trackedDomainId, domain.domainName, domain.verificationMethod);
    return { skipped: true, reason: "check_failed" };
  }

  // Step 3b: Determine failure action (database update only)
  const failureResult = await determineFailureAction({
    id: domain.id,
    verificationStatus: domain.verificationStatus,
    verificationFailedAt: domain.verificationFailedAt,
  });
  if (!failureResult) {
    return { skipped: true, reason: "invalid_state" };
  }

  // Step 4: Notify. Each email step skips itself if this failure episode
  // already has that notification, so re-running is safe.
  if (failureResult.email === "failing") {
    await sendVerificationFailingEmail({
      id: domain.id,
      domainName: domain.domainName,
      userId: domain.userId,
      userName: domain.userName,
      userEmail: domain.userEmail,
      verificationMethod: domain.verificationMethod,
      failedAt: failureResult.failedAt,
    });
  } else if (failureResult.email === "revoked") {
    await sendVerificationRevokedEmail({
      id: domain.id,
      domainName: domain.domainName,
      userId: domain.userId,
      userName: domain.userName,
      userEmail: domain.userEmail,
      verificationMethod: domain.verificationMethod,
      failedAt: failureResult.failedAt,
    });
    // Revoke only after the email is recorded: a revoked domain leaves the
    // re-verification cron, so a lost email could never be retried.
    await revokeVerificationStep(domain.id);
  }

  return { verified: false, action: failureResult.action };
}

/** Step: log a skipped reverification so chronic probe failures are visible. */
async function logCheckFailedSkip(
  trackedDomainId: string,
  domainName: string,
  method: VerificationMethod,
): Promise<void> {
  "use step";

  const { createLogger } = await import("@domainstack/logger");
  createLogger({ source: "workflows/reverify-ownership" }).warn(
    { trackedDomainId, domainName, method },
    "reverification probe failed to complete; skipping this run",
  );
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
  | { action: "marked_failing" | "in_grace_period"; email: "failing"; failedAt: Date }
  | { action: "revoked"; email: "revoked"; failedAt: Date }
  | { action: "in_grace_period"; email: null; failedAt: null };

/**
 * Decides what a failed check means for this domain and records the `failing`
 * state. Revocation is written later, after the revoked email is sent (a
 * revoked domain is no longer re-checked, so its email could never be retried).
 */
async function determineFailureAction(
  domain: DomainForFailureCheck,
): Promise<FailureActionResult | null> {
  "use step";

  const { calculateDaysElapsed } = await import("@domainstack/utils/expiry");
  const { VERIFICATION_GRACE_PERIOD_DAYS } = await import("@domainstack/constants");
  const { getTrackedDomainForReverification, markVerificationFailing } =
    await import("@domainstack/db/queries/tracked-domains");

  // The ownership probe runs outside this step. A concurrent run may have
  // recovered the domain or started a new failure episode in the meantime.
  const current = await getTrackedDomainForReverification(domain.id);
  if (
    !current ||
    current.verificationStatus !== domain.verificationStatus ||
    current.verificationFailedAt?.getTime() !== domain.verificationFailedAt?.getTime()
  ) {
    return null;
  }

  const failedAt = domain.verificationFailedAt ? new Date(domain.verificationFailedAt) : null;

  if (
    domain.verificationStatus === "verified" ||
    (domain.verificationStatus === "failing" && !failedAt)
  ) {
    // First failure of this episode (or a failing row missing its timestamp).
    const updated = await markVerificationFailing(
      domain.id,
      current.verificationStatus,
      current.verificationFailedAt,
    );
    if (!updated) return null;
    return {
      action: "marked_failing",
      email: "failing",
      failedAt: updated.verificationFailedAt ? new Date(updated.verificationFailedAt) : new Date(),
    };
  }

  if (domain.verificationStatus === "failing" && failedAt) {
    if (calculateDaysElapsed(failedAt, new Date()) >= VERIFICATION_GRACE_PERIOD_DAYS) {
      return { action: "revoked", email: "revoked", failedAt };
    }
    // Still in grace: the email step sends only if this episode has no warning
    // yet, which recovers a warning lost to an earlier failed run.
    return { action: "in_grace_period", email: "failing", failedAt };
  }

  return { action: "in_grace_period", email: null, failedAt: null };
}

async function revokeVerificationStep(trackedDomainId: string): Promise<void> {
  "use step";

  const { revokeVerification } = await import("@domainstack/db/queries/tracked-domains");
  await revokeVerification(trackedDomainId);
}

type DomainForEmail = Pick<
  DomainData,
  "id" | "domainName" | "userId" | "userName" | "userEmail" | "verificationMethod"
> & { failedAt: Date };

/**
 * Start of the duplicate-send window for a failure episode. An hour of slack
 * absorbs clock skew between the database (which stamps
 * `verificationFailedAt`) and the app (which stamps `sentAt`). Episodes are
 * at least 12 hours apart, so the slack can never reach a previous episode.
 */
function episodeStart(failedAt: Date): Date {
  return new Date(new Date(failedAt).getTime() - 60 * 60 * 1000);
}

/**
 * Step: Send verification failing notification email.
 *
 * Sends before recording; the idempotency contract for that is in
 * `sendNotification` (shared/notifications.ts). Skips if this failure episode
 * already has this notification.
 */
async function sendVerificationFailingEmail(domain: DomainForEmail): Promise<boolean> {
  "use step";

  const { default: VerificationFailingEmail } =
    await import("@domainstack/email/templates/verification-failing");
  const { VERIFICATION_GRACE_PERIOD_DAYS } = await import("@domainstack/constants");
  const { calculateDaysElapsed } = await import("@domainstack/utils/expiry");
  const { hasRecentNotification } = await import("@domainstack/db/queries/notifications");
  const { sendNotification } = await import("../steps/notifications");

  const alreadySent = await hasRecentNotification(
    domain.id,
    "verification_failing",
    episodeStart(domain.failedAt),
  );
  if (alreadySent) return false;

  // A catch-up email may go out mid-grace, so tell the user the days actually left.
  const daysLeft = Math.max(
    1,
    VERIFICATION_GRACE_PERIOD_DAYS - calculateDaysElapsed(domain.failedAt, new Date()),
  );

  const title = `Verification failing for ${domain.domainName}`;
  const subject = `⚠️ ${title}`;
  const message = `Verification for ${domain.domainName} is failing. You have ${daysLeft} days to fix it before access is revoked.`;

  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL as string;

  // Account-critical: sent regardless of mute and notification preferences.
  return await sendNotification(
    {
      userId: domain.userId,
      userEmail: domain.userEmail,
      trackedDomainId: domain.id,
      domainName: domain.domainName,
      notificationType: "verification_failing",
      title,
      message,
      emailSubject: subject,
      emailComponent: VerificationFailingEmail({
        userName: domain.userName.split(" ")[0] || "there",
        domainName: domain.domainName,
        verificationMethod: domain.verificationMethod,
        gracePeriodDays: daysLeft,
        baseUrl,
      }),
    },
    true,
    true,
  );
}

/**
 * Step: Send verification revoked notification email.
 *
 * Sends before recording, for the same reason as
 * {@link sendVerificationFailingEmail}. Skips if this failure episode already
 * has this notification.
 */
async function sendVerificationRevokedEmail(domain: DomainForEmail): Promise<boolean> {
  "use step";

  const { default: VerificationRevokedEmail } =
    await import("@domainstack/email/templates/verification-revoked");
  const { hasRecentNotification } = await import("@domainstack/db/queries/notifications");
  const { sendNotification } = await import("../steps/notifications");

  const alreadySent = await hasRecentNotification(
    domain.id,
    "verification_revoked",
    episodeStart(domain.failedAt),
  );
  if (alreadySent) return false;

  const title = `Verification revoked for ${domain.domainName}`;
  const subject = `❌ ${title}`;
  const message = `Verification for ${domain.domainName} has been revoked. The grace period has expired without successful re-verification.`;

  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL as string;

  // Account-critical: sent regardless of mute and notification preferences.
  return await sendNotification(
    {
      userId: domain.userId,
      userEmail: domain.userEmail,
      trackedDomainId: domain.id,
      domainName: domain.domainName,
      notificationType: "verification_revoked",
      title,
      message,
      emailSubject: subject,
      emailComponent: VerificationRevokedEmail({
        userName: domain.userName.split(" ")[0] || "there",
        domainName: domain.domainName,
        baseUrl,
      }),
    },
    true,
    true,
  );
}

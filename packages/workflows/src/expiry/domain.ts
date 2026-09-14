import { DOMAIN_EXPIRY_THRESHOLDS } from "@domainstack/constants";
import type { TrackedDomainForNotification } from "@domainstack/db/queries/tracked-domains";
import type { NotificationType } from "@domainstack/types";
import { formatDateLong } from "@domainstack/utils/date";

import {
  calculateDaysRemainingStep,
  checkAlreadySentStep,
  checkExpiryPreferencesStep,
  getThresholdNotificationType,
} from "../steps/notifications";

export interface DomainExpiryWorkflowInput {
  trackedDomainId: string;
}

export type DomainExpiryWorkflowResult =
  | {
      skipped: true;
      reason: "renewed";
      renewed: true;
      clearedCount: number;
    }
  | {
      skipped: true;
      reason:
        | "not_found"
        | "no_expiration_date"
        | "invalid_expiration_date"
        | "already_expired"
        | "no_threshold_met"
        | "notifications_disabled"
        | "already_sent";
    }
  | { skipped: false; sent: true };

/**
 * Domain expiry branch: checks if a tracked domain is approaching expiration
 * and sends notifications based on user preferences.
 *
 * Not a workflow entrypoint itself — composed into `expiryWorkflow` in
 * `./workflow`, which owns the single durable-workflow boundary.
 */
export async function checkDomainExpiry(
  input: DomainExpiryWorkflowInput,
): Promise<DomainExpiryWorkflowResult> {
  const { trackedDomainId } = input;

  // Step 1: Fetch domain data
  const domain = await fetchDomain(trackedDomainId);

  if (!domain) {
    return { skipped: true, reason: "not_found" };
  }

  if (!domain.expirationDate) {
    return { skipped: true, reason: "no_expiration_date" };
  }

  // Step 2: Calculate days remaining and check for renewal
  const daysRemaining = await calculateDaysRemainingStep(domain.expirationDate);
  const MAX_THRESHOLD_DAYS = Math.max(...DOMAIN_EXPIRY_THRESHOLDS);

  // The cron starts this workflow for every verified tracked domain, so an
  // already-expired (or unparseable) date reaches us here. The thresholds only
  // describe an approaching expiry and getThresholdNotificationType maps
  // anything at or below the smallest one, so without this guard an expired
  // domain alerts "expires in -12 days" and re-alerts every time the 30-day
  // already-sent window lapses.
  if (!Number.isFinite(daysRemaining)) {
    return { skipped: true, reason: "invalid_expiration_date" };
  }
  if (daysRemaining < 0) {
    return { skipped: true, reason: "already_expired" };
  }

  // Detect renewal: If expiration is now beyond our notification window,
  // clear previous notifications so they can be re-sent when approaching expiry again.
  if (daysRemaining > MAX_THRESHOLD_DAYS) {
    const cleared = await clearRenewedNotifications(trackedDomainId);
    return {
      skipped: true,
      reason: "renewed",
      renewed: true,
      clearedCount: cleared,
    };
  }

  // Step 3: Determine notification type
  const notificationType = getThresholdNotificationType(
    daysRemaining,
    DOMAIN_EXPIRY_THRESHOLDS,
    "domain_expiry",
  );
  if (!notificationType) {
    return { skipped: true, reason: "no_threshold_met" };
  }

  // Step 4: Check notification preferences
  const prefs = await checkExpiryPreferencesStep(domain.userId, domain.muted, "domainExpiry");
  if (!prefs.shouldSendEmail && !prefs.shouldSendInApp) {
    return { skipped: true, reason: "notifications_disabled" };
  }

  // Step 5: Check if already sent
  const alreadySent = await checkAlreadySentStep(trackedDomainId, notificationType);
  if (alreadySent) {
    return { skipped: true, reason: "already_sent" };
  }

  // Step 6: Build the notification content (pure — no I/O, safe to recompute)
  const expirationDate = new Date(domain.expirationDate);
  const { title, subject, message } = buildDomainExpiryContent({
    domainName: domain.domainName,
    expirationDate,
    daysRemaining,
    registrar: domain.registrar ?? undefined,
  });

  // Step 7: Send and record. Email goes first inside the step so a failed send
  // leaves no dedup row behind (see sendNotification in shared/notifications.ts).
  await sendDomainExpiryNotification(
    {
      userId: domain.userId,
      userEmail: domain.userEmail,
      userName: domain.userName,
      trackedDomainId,
      domainName: domain.domainName,
      notificationType,
      title,
      message,
      subject,
      expirationDate,
      daysRemaining,
      registrar: domain.registrar ?? undefined,
    },
    prefs.shouldSendEmail,
    prefs.shouldSendInApp,
  );

  return { skipped: false, sent: true };
}

async function fetchDomain(trackedDomainId: string): Promise<TrackedDomainForNotification | null> {
  "use step";

  const { getTrackedDomainForNotification } =
    await import("@domainstack/db/queries/tracked-domains");

  return await getTrackedDomainForNotification(trackedDomainId);
}

async function clearRenewedNotifications(trackedDomainId: string): Promise<number> {
  "use step";

  const { clearDomainExpiryNotifications } = await import("@domainstack/db/queries/notifications");

  return await clearDomainExpiryNotifications(trackedDomainId);
}

function buildDomainExpiryContent(params: {
  domainName: string;
  expirationDate: Date;
  daysRemaining: number;
  registrar?: string;
}): { title: string; subject: string; message: string } {
  const { domainName, expirationDate, daysRemaining, registrar } = params;

  const title = `${domainName} expires in ${daysRemaining} day${daysRemaining === 1 ? "" : "s"}`;
  const subject = `${daysRemaining <= 7 ? "⚠️ " : ""}${title}`;
  const message = `Your domain ${domainName} will expire on ${formatDateLong(expirationDate)}${registrar ? ` (registered with ${registrar})` : ""}.`;

  return { title, subject, message };
}

async function sendDomainExpiryNotification(
  params: {
    userId: string;
    userEmail: string;
    userName: string;
    trackedDomainId: string;
    domainName: string;
    notificationType: NotificationType;
    title: string;
    message: string;
    subject: string;
    expirationDate: Date;
    daysRemaining: number;
    registrar?: string;
  },
  shouldSendEmail: boolean,
  shouldSendInApp: boolean,
): Promise<boolean> {
  "use step";

  const { default: DomainExpiryEmail } = await import("@domainstack/email/templates/domain-expiry");
  const { sendNotification } = await import("../steps/notifications");

  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL as string;

  return await sendNotification(
    {
      userId: params.userId,
      userEmail: params.userEmail,
      trackedDomainId: params.trackedDomainId,
      domainName: params.domainName,
      notificationType: params.notificationType,
      title: params.title,
      message: params.message,
      emailSubject: params.subject,
      emailComponent: DomainExpiryEmail({
        userName: params.userName.split(" ")[0] || "there",
        domainName: params.domainName,
        expirationDate: formatDateLong(params.expirationDate),
        daysRemaining: params.daysRemaining,
        registrar: params.registrar,
        baseUrl,
      }),
    },
    shouldSendEmail,
    shouldSendInApp,
  );
}

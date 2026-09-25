import { DOMAIN_EXPIRY_THRESHOLDS } from "@domainstack/constants";
import type { TrackedDomainForNotification } from "@domainstack/db/queries/tracked-domains";
import type { NotificationType } from "@domainstack/types";
import { formatDateLong } from "@domainstack/utils/date";
import { calculateDaysRemaining } from "@domainstack/utils/expiry";

import type { NotificationChannels } from "../steps/notifications";
import { type ExpirySkipResult, evaluateExpiryNotification } from "./thresholds";

export interface DomainExpiryWorkflowInput {
  trackedDomainId: string;
}

export type DomainExpiryWorkflowResult =
  | ExpirySkipResult
  | {
      skipped: true;
      reason: "not_found" | "no_expiration_date" | "invalid_expiration_date" | "already_expired";
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

  // Days remaining is computed in the workflow body: the sandbox fixes `Date`
  // per replay, so no step is needed to keep it deterministic.
  const daysRemaining = calculateDaysRemaining(domain.expirationDate);

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

  // Steps 3-5: renewal, threshold, preferences, and already-sent checks
  const check = await evaluateExpiryNotification({
    trackedDomainId,
    daysRemaining,
    thresholds: DOMAIN_EXPIRY_THRESHOLDS,
    prefix: "domain_expiry",
    preferenceKey: "domainExpiry",
    userId: domain.userId,
    muted: domain.muted,
    clearRenewed: clearRenewedNotifications,
  });
  if (check.skipped) return check;
  const { notificationType, prefs } = check;

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
    prefs,
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

interface DomainExpiryContentInput {
  domainName: string;
  expirationDate: Date;
  daysRemaining: number;
  registrar?: string;
}

interface DomainExpiryContent {
  title: string;
  subject: string;
  message: string;
}

function buildDomainExpiryContent(params: DomainExpiryContentInput): DomainExpiryContent {
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
  channels: NotificationChannels,
): Promise<boolean> {
  "use step";

  const { default: DomainExpiryEmail } = await import("@domainstack/email/templates/domain-expiry");
  const { sendNotification } = await import("../steps/notifications");
  const { getBaseUrl, getFirstName } = await import("../steps/email");

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
        userName: getFirstName(params.userName),
        domainName: params.domainName,
        expirationDate: formatDateLong(params.expirationDate),
        daysRemaining: params.daysRemaining,
        registrar: params.registrar,
        baseUrl: getBaseUrl(),
      }),
    },
    channels,
  );
}

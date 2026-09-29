import { DOMAIN_EXPIRY_THRESHOLDS, EXPIRING_CRITICAL_DAYS } from "@domainstack/constants";
import type { TrackedDomainForNotification } from "@domainstack/db/queries/tracked-domains";
import type { NotificationType } from "@domainstack/types";
import { formatDateLong } from "@domainstack/utils/date";
import { calculateDaysRemaining, inDaysPhrase } from "@domainstack/utils/expiry";

import type { NotificationChannels } from "../steps/notifications";
import { type ExpirySkipResult, evaluateExpiryNotification } from "./thresholds";

export interface DomainExpiryWorkflowInput {
  trackedDomainId: string;
}

export type DomainExpiryWorkflowResult =
  | ExpirySkipResult
  | {
      skipped: true;
      reason:
        | "not_found"
        | "data_unavailable"
        | "no_expiration_date"
        | "invalid_expiration_date"
        | "already_expired";
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

  // Step 1: Load the registration, refreshing it first when its cache window
  // has elapsed. Everything below uses the row this step returns.
  const loaded = await loadFreshDomain(trackedDomainId);

  if (loaded.status !== "ok") {
    return { skipped: true, reason: loaded.status };
  }
  const { domain } = loaded;

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
  // leaves no dedup row behind (see sendNotification in steps/notifications.ts).
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

type LoadFreshDomainResult =
  | { status: "ok"; domain: TrackedDomainForNotification }
  | { status: "not_found" }
  | { status: "data_unavailable" };

/**
 * Load the tracked domain's registration for an expiry decision. A warning must
 * not come from stale data, so a row past its policy window is refreshed from
 * the source and reloaded; if the source can't supply it, the alert is skipped
 * until the next cron run rather than sent from an old date.
 */
async function loadFreshDomain(trackedDomainId: string): Promise<LoadFreshDomainResult> {
  "use step";

  const { getTrackedDomainForNotification } =
    await import("@domainstack/db/queries/tracked-domains");
  const { classifyDatabaseError } = await import("../lib/errors");

  const load = async (): Promise<TrackedDomainForNotification | null> => {
    try {
      return await getTrackedDomainForNotification(trackedDomainId);
    } catch (err) {
      throw classifyDatabaseError(err, {
        context: `loading tracked domain ${trackedDomainId} for expiry`,
      });
    }
  };
  const isFresh = (row: TrackedDomainForNotification) =>
    row.registrationExpiresAt.getTime() > Date.now();

  const domain = await load();
  if (!domain) return { status: "not_found" };
  if (isFresh(domain)) return { status: "ok", domain };

  const { RemoteDataUnavailableError } = await import("@domainstack/core/lib/fetch-errors");
  const { fetchSection } = await import("@domainstack/core/lookup");

  try {
    const result = await fetchSection("registration", domain.domainName);
    if (!result.success) return { status: "data_unavailable" };
  } catch (err) {
    // The remote target couldn't supply data (WHOIS/RDAP timeout). Retrying
    // within this run rarely helps; the next cron run tries again.
    if (err instanceof RemoteDataUnavailableError) {
      return { status: "data_unavailable" };
    }
    throw err;
  }

  // Reload: the refresh may have changed the expiration date, and the tracked
  // domain may have been archived or unverified while it ran.
  const refreshed = await load();
  if (!refreshed) return { status: "not_found" };
  if (!isFresh(refreshed)) {
    const { createLogger } = await import("@domainstack/logger");
    createLogger({ source: "workflows/expiry" }).warn(
      { trackedDomainId, section: "registration" },
      "registration still stale after refresh, skipping expiry check",
    );
    return { status: "data_unavailable" };
  }
  return { status: "ok", domain: refreshed };
}

async function clearRenewedNotifications(trackedDomainId: string): Promise<number> {
  "use step";

  const { clearDomainExpiryNotifications } = await import("@domainstack/db/queries/notifications");

  try {
    return await clearDomainExpiryNotifications(trackedDomainId);
  } catch (err) {
    const { classifyDatabaseError } = await import("../lib/errors");
    throw classifyDatabaseError(err, {
      context: `clearing renewed expiry notifications for ${trackedDomainId}`,
    });
  }
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

  const title = `${domainName} expires ${inDaysPhrase(daysRemaining)}`;
  const subject = `${daysRemaining <= EXPIRING_CRITICAL_DAYS ? "⚠️ " : ""}${title}`;
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
      // One alert per threshold per expiration date; a renewal changes the date.
      dedupeKey: `domain-expiry:${params.trackedDomainId}:${new Date(params.expirationDate).toISOString()}:${params.notificationType}`,
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

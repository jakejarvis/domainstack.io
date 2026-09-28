import { CERTIFICATE_EXPIRY_THRESHOLDS } from "@domainstack/constants";
import type { TrackedDomainCertificate } from "@domainstack/db/queries/certificates";
import type { NotificationType } from "@domainstack/types";
import { formatDateLong } from "@domainstack/utils/date";
import { calculateDaysRemaining } from "@domainstack/utils/expiry";

import type { NotificationChannels } from "../steps/notifications";
import { type ExpirySkipResult, evaluateExpiryNotification } from "./thresholds";

export interface CertificateExpiryWorkflowInput {
  trackedDomainId: string;
}

export type CertificateExpiryWorkflowResult =
  | ExpirySkipResult
  | {
      skipped: true;
      reason: "not_found" | "data_unavailable" | "invalid_expiration_date" | "already_expired";
    }
  | { skipped: false; sent: true };

/**
 * Certificate expiry branch: checks if a tracked domain's leaf TLS
 * certificate is approaching expiration and sends notifications based on
 * user preferences.
 *
 * Not a workflow entrypoint itself — composed into `expiryWorkflow` in
 * `./workflow`, which owns the single durable-workflow boundary.
 */
export async function checkCertificateExpiry(
  input: CertificateExpiryWorkflowInput,
): Promise<CertificateExpiryWorkflowResult> {
  const { trackedDomainId } = input;

  // Step 1: Load the leaf certificate, refreshing the domain's certificates
  // first when their cache window has elapsed. Everything below uses the row
  // this step returns.
  const loaded = await loadFreshCertificate(trackedDomainId);

  if (loaded.status !== "ok") {
    return { skipped: true, reason: loaded.status };
  }
  const { cert } = loaded;

  // Days remaining is computed in the workflow body: the sandbox fixes `Date`
  // per replay, so no step is needed to keep it deterministic.
  const daysRemaining = calculateDaysRemaining(cert.validTo);

  // The cron starts this workflow for every verified tracked domain holding a
  // certificate, so an already-expired one reaches us here. The thresholds only
  // describe an approaching expiry and getThresholdNotificationType maps
  // anything at or below the smallest one, so without this guard an expired
  // certificate alerts "expires in -12 days".
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
    thresholds: CERTIFICATE_EXPIRY_THRESHOLDS,
    prefix: "certificate_expiry",
    preferenceKey: "certificateExpiry",
    userId: cert.userId,
    muted: cert.muted,
    clearRenewed: clearRenewedNotifications,
  });
  if (check.skipped) return check;
  const { notificationType, prefs } = check;

  // Step 6: Build the notification content (pure — no I/O, safe to recompute)
  const { title, subject, message } = buildCertificateExpiryContent({
    domainName: cert.domainName,
    validTo: cert.validTo,
    issuer: cert.issuer,
    daysRemaining,
  });

  // Step 7: Send and record. Email goes first inside the step so a failed send
  // leaves no dedup row behind (see sendNotification in steps/notifications.ts).
  await sendCertificateExpiryNotification(
    {
      userId: cert.userId,
      userEmail: cert.userEmail,
      userName: cert.userName,
      trackedDomainId,
      domainName: cert.domainName,
      notificationType,
      title,
      message,
      subject,
      validTo: cert.validTo,
      issuer: cert.issuer,
      daysRemaining,
    },
    prefs,
  );

  return { skipped: false, sent: true };
}

type LoadFreshCertificateResult =
  | { status: "ok"; cert: TrackedDomainCertificate }
  | { status: "not_found" }
  | { status: "data_unavailable" };

/**
 * Load the leaf certificate for an expiry decision. A warning must not come
 * from stale data, so a certificate whose `certificate_checks` window is
 * elapsed (or missing) is refreshed from the host and reloaded; if the host
 * can't supply it, the alert is skipped until the next cron run.
 */
async function loadFreshCertificate(trackedDomainId: string): Promise<LoadFreshCertificateResult> {
  "use step";

  const { getEarliestCertificate } = await import("@domainstack/db/queries/certificates");
  const { classifyDatabaseError } = await import("../lib/errors");

  const load = async (): Promise<TrackedDomainCertificate | null> => {
    try {
      return await getEarliestCertificate(trackedDomainId);
    } catch (err) {
      throw classifyDatabaseError(err, {
        context: `loading certificate for tracked domain ${trackedDomainId} for expiry`,
      });
    }
  };
  // A missing check row (null) is stale, never fresh.
  const isFresh = (row: TrackedDomainCertificate) =>
    row.checkExpiresAt !== null && row.checkExpiresAt.getTime() > Date.now();

  const cert = await load();
  if (!cert) return { status: "not_found" };
  if (isFresh(cert)) return { status: "ok", cert };

  const { RemoteDataUnavailableError } = await import("@domainstack/core/lib/fetch-errors");
  const { fetchSection } = await import("@domainstack/core/lookup");

  try {
    const result = await fetchSection("certificates", cert.domainName);
    if (!result.success) return { status: "data_unavailable" };
  } catch (err) {
    // The remote target couldn't supply data (unreachable host, TLS handshake
    // failure). Retrying within this run rarely helps; the next cron run tries again.
    if (err instanceof RemoteDataUnavailableError) {
      return { status: "data_unavailable" };
    }
    throw err;
  }

  // Reload: a renewal changes validTo, and the tracked domain may have been
  // archived or unverified while the refresh ran.
  const refreshed = await load();
  if (!refreshed) return { status: "not_found" };
  if (!isFresh(refreshed)) {
    const { createLogger } = await import("@domainstack/logger");
    createLogger({ source: "workflows/expiry" }).warn(
      { trackedDomainId, section: "certificates" },
      "certificates still stale after refresh, skipping expiry check",
    );
    return { status: "data_unavailable" };
  }
  return { status: "ok", cert: refreshed };
}

async function clearRenewedNotifications(trackedDomainId: string): Promise<number> {
  "use step";

  const { clearCertificateExpiryNotifications } =
    await import("@domainstack/db/queries/notifications");

  return await clearCertificateExpiryNotifications(trackedDomainId);
}

interface CertificateExpiryContentInput {
  domainName: string;
  validTo: Date;
  issuer: string;
  daysRemaining: number;
}

interface ExpiryContent {
  title: string;
  subject: string;
  message: string;
}

function buildCertificateExpiryContent(params: CertificateExpiryContentInput): ExpiryContent {
  const { domainName, validTo, issuer, daysRemaining } = params;

  const title = `SSL certificate for ${domainName} expires in ${daysRemaining} day${daysRemaining === 1 ? "" : "s"}`;
  const subject = `${daysRemaining <= 3 ? "🔒⚠️ " : "🔒 "}${title}`;
  const message = `The SSL certificate for ${domainName} (issued by ${issuer}) will expire on ${formatDateLong(validTo)}.`;

  return { title, subject, message };
}

async function sendCertificateExpiryNotification(
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
    validTo: Date;
    issuer: string;
    daysRemaining: number;
  },
  channels: NotificationChannels,
): Promise<boolean> {
  "use step";

  const { default: CertificateExpiryEmail } =
    await import("@domainstack/email/templates/certificate-expiry");
  const { sendNotification } = await import("../steps/notifications");
  const { getBaseUrl, getFirstName } = await import("../steps/email");
  const { createHash } = await import("node:crypto");

  // The earliest-certificate query exposes no fingerprint, so the issuer hash
  // plus validTo identify the certificate; a renewal changes validTo.
  const issuerHash = createHash("sha256").update(params.issuer).digest("hex").slice(0, 16);

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
      dedupeKey: `certificate-expiry:${params.trackedDomainId}:${new Date(params.validTo).toISOString()}:${issuerHash}:${params.notificationType}`,
      emailComponent: CertificateExpiryEmail({
        userName: getFirstName(params.userName),
        domainName: params.domainName,
        expirationDate: formatDateLong(params.validTo),
        daysRemaining: params.daysRemaining,
        issuer: params.issuer,
        baseUrl: getBaseUrl(),
      }),
    },
    channels,
  );
}

import "server-only";

import { differenceInDays, format } from "date-fns";
import type { Logger } from "inngest";
import { CertificateExpiryEmail } from "@/emails/certificate-expiry";
import { getEarliestCertificate } from "@/lib/db/repos/certificates";
import {
  clearCertificateExpiryNotifications,
  createNotification,
  hasRecentNotification,
  type NotificationType,
  updateNotificationResendId,
} from "@/lib/db/repos/notifications";
import { getOrCreateUserNotificationPreferences } from "@/lib/db/repos/user-notification-preferences";
import { inngest } from "@/lib/inngest/client";
import { INNGEST_EVENTS } from "@/lib/inngest/events";
import {
  generateIdempotencyKey,
  getCertificateExpiryNotificationType,
} from "@/lib/notification-utils";
import { sendPrettyEmail } from "@/lib/resend";

export const checkCertificateExpiryWorker = inngest.createFunction(
  {
    id: "check-certificate-expiry-worker",
    retries: 3,
    concurrency: {
      limit: 5,
    },
  },
  { event: INNGEST_EVENTS.CHECK_CERTIFICATE_EXPIRY },
  async ({ event, step, logger: inngestLogger }) => {
    const { trackedDomainId } = event.data;

    const cert = await step.run("fetch-certificate", async () => {
      return await getEarliestCertificate(trackedDomainId);
    });

    if (!cert) {
      return { skipped: true, reason: "not_found" };
    }

    const { daysRemaining, validTo } = await step.run(
      "calculate-days-remaining",
      async () => {
        const now = new Date();
        return {
          daysRemaining: differenceInDays(cert.validTo, now),
          validTo: cert.validTo,
        };
      },
    );
    const MAX_THRESHOLD_DAYS = 14;

    if (daysRemaining > MAX_THRESHOLD_DAYS) {
      const cleared = await step.run("clear-renewed", async () => {
        return await clearCertificateExpiryNotifications(trackedDomainId);
      });
      return { renewed: true, clearedCount: cleared };
    }

    const notificationType =
      getCertificateExpiryNotificationType(daysRemaining);
    if (!notificationType) {
      return { skipped: true, reason: "no_threshold_met" };
    }

    // Check preferences
    const { shouldSendEmail, shouldSendInApp } = await step.run(
      "check-prefs",
      async () => {
        const globalPrefs = await getOrCreateUserNotificationPreferences(
          cert.userId,
        );

        // Check for domain-specific override
        const override = cert.notificationOverrides.certificateExpiry;
        if (override !== undefined) {
          return {
            shouldSendEmail: override.email,
            shouldSendInApp: override.inApp,
          };
        }

        // Fall back to global preferences
        return {
          shouldSendEmail: globalPrefs.certificateExpiry.email,
          shouldSendInApp: globalPrefs.certificateExpiry.inApp,
        };
      },
    );

    if (!shouldSendEmail && !shouldSendInApp) {
      return { skipped: true, reason: "notifications_disabled" };
    }

    const alreadySent = await step.run("check-sent", async () => {
      return await hasRecentNotification(trackedDomainId, notificationType);
    });

    if (alreadySent) {
      return { skipped: true, reason: "already_sent" };
    }

    const sent = await step.run("send-email", async () => {
      return await sendCertificateExpiryNotification(
        {
          trackedDomainId,
          domainName: cert.domainName,
          userId: cert.userId,
          userName: cert.userName,
          userEmail: cert.userEmail,
          validTo: new Date(validTo),
          issuer: cert.issuer,
          daysRemaining,
          notificationType,
          shouldSendEmail,
          shouldSendInApp,
        },
        inngestLogger,
      );
    });

    return { sent };
  },
);

async function sendCertificateExpiryNotification(
  {
    trackedDomainId,
    domainName,
    userId,
    userName,
    userEmail,
    validTo,
    issuer,
    daysRemaining,
    notificationType,
    shouldSendEmail,
    shouldSendInApp,
  }: {
    trackedDomainId: string;
    domainName: string;
    userId: string;
    userName: string;
    userEmail: string;
    validTo: Date;
    issuer: string;
    daysRemaining: number;
    notificationType: NotificationType;
    shouldSendEmail: boolean;
    shouldSendInApp: boolean;
  },
  logger: Logger,
): Promise<boolean> {
  const idempotencyKey = generateIdempotencyKey(
    trackedDomainId,
    notificationType,
  );

  const title = `SSL certificate for ${domainName} expires in ${daysRemaining} day${daysRemaining === 1 ? "" : "s"}`;
  const subject = `${daysRemaining <= 3 ? "🔒⚠️ " : "🔒 "}${title}`;
  const message = `The SSL certificate for ${domainName} (issued by ${issuer}) will expire on ${format(validTo, "MMMM d, yyyy")}.`;

  const channels: string[] = [];
  if (shouldSendEmail) channels.push("email");
  if (shouldSendInApp) channels.push("in-app");

  try {
    // Create in-app notification first
    const notification = await createNotification({
      userId,
      trackedDomainId,
      type: notificationType,
      title,
      message,
      data: { domainName },
      channels,
    });

    if (!notification) {
      logger.error("Failed to create notification record", {
        trackedDomainId,
        notificationType,
        domainName,
      });
      throw new Error("Failed to create notification record in database");
    }

    // Send email notification if enabled
    if (shouldSendEmail) {
      const { data, error } = await sendPrettyEmail(
        {
          to: userEmail,
          subject,
          react: CertificateExpiryEmail({
            userName: userName.split(" ")[0] || "there",
            domainName,
            expirationDate: format(validTo, "MMMM d, yyyy"),
            daysRemaining,
            issuer,
          }),
        },
        { idempotencyKey },
      );

      if (error) throw new Error(`Resend error: ${error.message}`);

      // Update notification with email ID
      if (data?.id) {
        await updateNotificationResendId(notification.id, data.id);
      }
    }

    return true;
  } catch (err) {
    logger.error("Error sending certificate expiry notification", err, {
      domainName,
      userId,
      idempotencyKey,
    });
    throw err;
  }
}

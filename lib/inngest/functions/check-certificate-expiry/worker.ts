import "server-only";

import { differenceInDays, format } from "date-fns";
import type { Logger } from "inngest";
import { CertificateExpiryEmail } from "@/emails/certificate-expiry";
import { getEarliestCertificate } from "@/lib/db/repos/certificates";
import {
  clearCertificateExpiryNotifications,
  createNotification,
  hasNotificationBeenSent,
  updateNotificationResendId,
} from "@/lib/db/repos/notifications";
import { getOrCreateUserNotificationPreferences } from "@/lib/db/repos/user-notification-preferences";
import { inngest } from "@/lib/inngest/client";
import { INNGEST_EVENTS } from "@/lib/inngest/events";
import {
  generateIdempotencyKey,
  getCertificateExpiryNotificationType,
  type NotificationType,
} from "@/lib/notifications";
import { sendPrettyEmail } from "@/lib/resend";

export const checkCertificateExpiryWorker = inngest.createFunction(
  {
    id: "check-certificate-expiry-worker",
    retries: 3,
    concurrency: {
      limit: 20,
    },
  },
  { event: INNGEST_EVENTS.CHECK_CERTIFICATE_EXPIRY },
  async ({ event, step, logger: inngestLogger }) => {
    const { trackedDomainId } = event.data;

    const cert = await step.run("fetch-certificate", async () => {
      return await getEarliestCertificate(trackedDomainId);
    });

    if (!cert) {
      inngestLogger.warn("Certificate not found, skipping", {
        trackedDomainId,
      });
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

    const shouldNotify = await step.run("check-prefs", async () => {
      if (cert.notificationOverrides.certificateExpiry !== undefined) {
        return cert.notificationOverrides.certificateExpiry;
      }
      const globalPrefs = await getOrCreateUserNotificationPreferences(
        cert.userId,
      );
      return globalPrefs.certificateExpiry;
    });

    if (!shouldNotify) {
      return { skipped: true, reason: "notifications_disabled" };
    }

    const alreadySent = await step.run("check-sent", async () => {
      return await hasNotificationBeenSent(trackedDomainId, notificationType);
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
  },
  logger: Logger,
): Promise<boolean> {
  const idempotencyKey = generateIdempotencyKey(
    trackedDomainId,
    notificationType,
  );

  try {
    const { data, error } = await sendPrettyEmail(
      {
        to: userEmail,
        subject: `${daysRemaining <= 3 ? "🔒⚠️ " : "🔒 "}SSL certificate for ${domainName} expires in ${daysRemaining} day${daysRemaining === 1 ? "" : "s"}`,
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

    const notification = await createNotification({
      trackedDomainId,
      type: notificationType,
    });

    if (!notification) {
      logger.error("Failed to create notification record", {
        trackedDomainId,
        notificationType,
        domainName,
      });
      throw new Error("Failed to create notification record in database");
    }

    if (data?.id) {
      await updateNotificationResendId(
        trackedDomainId,
        notificationType,
        data.id,
      );
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

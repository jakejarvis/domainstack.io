import "server-only";

import { differenceInDays, format } from "date-fns";
import { CertificateExpiryEmail } from "@/emails/certificate-expiry";
import { getVerifiedTrackedDomainsCertificates } from "@/lib/db/repos/certificates";
import {
  clearCertificateExpiryNotifications,
  createNotification,
  hasNotificationBeenSent,
  updateNotificationResendId,
} from "@/lib/db/repos/notifications";
import { getOrCreateUserNotificationPreferences } from "@/lib/db/repos/user-notification-preferences";
import { inngest } from "@/lib/inngest/client";
import { createLogger } from "@/lib/logger/server";
import {
  generateIdempotencyKey,
  getCertificateExpiryNotificationType,
  type NotificationType,
} from "@/lib/notifications";
import { sendPrettyEmail } from "@/lib/resend";

const logger = createLogger({ source: "check-certificate-expiry" });

/**
 * Cron job to check for expiring SSL certificates and send email notifications.
 * Runs daily at 9:15 AM UTC (15 minutes after domain expiry check).
 */
export const checkCertificateExpiry = inngest.createFunction(
  {
    id: "check-certificate-expiry",
    retries: 3,
    concurrency: {
      limit: 1,
    },
  },
  { cron: "15 9 * * *" },
  async ({ step, logger: inngestLogger }) => {
    inngestLogger.info("Starting certificate expiry check");

    // Get all certificates for verified tracked domains
    const trackedCertificates = await step.run(
      "fetch-tracked-certificates",
      async () => {
        return await getVerifiedTrackedDomainsCertificates();
      },
    );

    inngestLogger.info(
      `Found ${trackedCertificates.length} tracked certificates`,
    );

    const results = {
      total: trackedCertificates.length,
      notificationsSent: 0,
      skipped: 0,
      errors: 0,
      renewalsDetected: 0,
    };

    // Max threshold is 14 days - if cert has more days remaining, it may have been renewed
    const MAX_THRESHOLD_DAYS = 14;

    for (const cert of trackedCertificates) {
      const daysRemaining = differenceInDays(cert.validTo, new Date());

      // Detect certificate renewal: if validity is beyond max threshold,
      // clear any existing notifications so we can send fresh ones for the new cert
      if (daysRemaining > MAX_THRESHOLD_DAYS) {
        const cleared = await step.run(
          `clear-renewed-${cert.trackedDomainId}`,
          async () => {
            return await clearCertificateExpiryNotifications(
              cert.trackedDomainId,
            );
          },
        );
        if (cleared > 0) {
          results.renewalsDetected++;
        }
        results.skipped++;
        continue;
      }

      // Skip if not within any notification threshold
      const notificationType =
        getCertificateExpiryNotificationType(daysRemaining);
      if (!notificationType) {
        results.skipped++;
        continue;
      }

      // Check notification preferences
      const shouldNotify = await step.run(
        `check-prefs-${cert.trackedDomainId}`,
        async () => {
          // Check per-domain override first
          if (cert.notificationOverrides.certificateExpiry !== undefined) {
            return cert.notificationOverrides.certificateExpiry;
          }
          // Fall back to global preferences
          const globalPrefs = await getOrCreateUserNotificationPreferences(
            cert.userId,
          );
          return globalPrefs.certificateExpiry;
        },
      );

      if (!shouldNotify) {
        results.skipped++;
        continue;
      }

      // Check if this notification was already sent
      const alreadySent = await step.run(
        `check-sent-${cert.trackedDomainId}-${notificationType}`,
        async () => {
          return await hasNotificationBeenSent(
            cert.trackedDomainId,
            notificationType,
          );
        },
      );

      if (alreadySent) {
        results.skipped++;
        continue;
      }

      // Send notification email
      const certValidTo = cert.validTo;
      const sent = await step.run(
        `send-email-${cert.trackedDomainId}`,
        async () => {
          // Ensure validTo is a Date object (may be serialized as string)
          const validToDate = new Date(certValidTo);
          return await sendCertificateExpiryNotification({
            trackedDomainId: cert.trackedDomainId,
            domainName: cert.domainName,
            userId: cert.userId,
            userName: cert.userName,
            userEmail: cert.userEmail,
            validTo: validToDate,
            issuer: cert.issuer,
            daysRemaining,
            notificationType,
          });
        },
      );

      if (sent) {
        results.notificationsSent++;
      } else {
        results.errors++;
      }
    }

    inngestLogger.info("Certificate expiry check complete", results);
    return results;
  },
);

async function sendCertificateExpiryNotification({
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
}): Promise<boolean> {
  const idempotencyKey = generateIdempotencyKey(
    trackedDomainId,
    notificationType,
  );

  try {
    // Create notification record first
    const notificationRecord = await createNotification({
      trackedDomainId,
      type: notificationType,
    });

    if (!notificationRecord) {
      logger.debug("Notification already recorded", {
        trackedDomainId,
        notificationType,
      });
    }

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
      {
        idempotencyKey,
      },
    );

    if (error) {
      logger.error("Failed to send certificate expiry email", error, {
        domainName,
        userId,
        idempotencyKey,
      });
      throw new Error(`Resend error: ${error.message}`);
    }

    // Store Resend ID for troubleshooting
    if (data?.id) {
      await updateNotificationResendId(
        trackedDomainId,
        notificationType,
        data.id,
      );
    }

    logger.info("Sent certificate expiry notification", {
      domainName,
      userId,
      emailId: data?.id,
      daysRemaining,
      idempotencyKey,
    });

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

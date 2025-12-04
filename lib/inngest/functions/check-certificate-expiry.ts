import "server-only";

import { render } from "@react-email/components";
import { differenceInDays, format } from "date-fns";
import type React from "react";
import { CertificateExpiryEmail } from "@/emails/certificate-expiry";
import { BASE_URL } from "@/lib/constants";
import { getVerifiedTrackedDomainsCertificates } from "@/lib/db/repos/certificates";
import {
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
import { RESEND_FROM_EMAIL, resend } from "@/lib/resend";

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
    };

    for (const cert of trackedCertificates) {
      const daysRemaining = differenceInDays(cert.validTo, new Date());

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
  userName,
  userEmail,
  validTo,
  issuer,
  daysRemaining,
  notificationType,
}: {
  trackedDomainId: string;
  domainName: string;
  userName: string;
  userEmail: string;
  validTo: Date;
  issuer: string;
  daysRemaining: number;
  notificationType: NotificationType;
}): Promise<boolean> {
  if (!resend) {
    logger.warn("Resend not configured, skipping email", { domainName });
    return false;
  }

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

    const dashboardUrl = `${BASE_URL}/dashboard`;

    const emailHtml = await render(
      CertificateExpiryEmail({
        userName: userName.split(" ")[0] || "there",
        domainName,
        expirationDate: format(validTo, "MMMM d, yyyy"),
        daysRemaining,
        issuer,
        dashboardUrl,
      }) as React.ReactElement,
    );

    const { data, error } = await resend.emails.send(
      {
        from: `Domainstack <${RESEND_FROM_EMAIL}>`,
        to: userEmail,
        subject: `${daysRemaining <= 3 ? "🔒⚠️ " : "🔒 "}SSL certificate for ${domainName} expires in ${daysRemaining} day${daysRemaining === 1 ? "" : "s"}`,
        html: emailHtml,
      },
      {
        idempotencyKey,
      },
    );

    if (error) {
      logger.error("Failed to send certificate expiry email", error, {
        domainName,
        userEmail,
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
      userEmail,
      emailId: data?.id,
      daysRemaining,
      idempotencyKey,
    });

    return true;
  } catch (err) {
    logger.error("Error sending certificate expiry notification", err, {
      domainName,
      userEmail,
      idempotencyKey,
    });
    throw err;
  }
}

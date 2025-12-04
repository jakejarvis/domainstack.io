import "server-only";

import { render } from "@react-email/components";
import { differenceInDays, format } from "date-fns";
import type React from "react";
import { DomainExpiryEmail } from "@/emails/domain-expiry";
import { BASE_URL } from "@/lib/constants";
import {
  createNotification,
  hasNotificationBeenSent,
  type NotificationType,
} from "@/lib/db/repos/notifications";
import { getVerifiedTrackedDomainsWithExpiry } from "@/lib/db/repos/tracked-domains";
import { inngest } from "@/lib/inngest/client";
import { createLogger } from "@/lib/logger/server";
import { RESEND_FROM_EMAIL, resend } from "@/lib/resend";

const logger = createLogger({ source: "check-domain-expiry" });

// Notification thresholds in days
const _NOTIFICATION_THRESHOLDS = [30, 14, 7, 1] as const;

function getNotificationType(daysRemaining: number): NotificationType | null {
  if (daysRemaining <= 1) return "domain_expiry_1d";
  if (daysRemaining <= 7) return "domain_expiry_7d";
  if (daysRemaining <= 14) return "domain_expiry_14d";
  if (daysRemaining <= 30) return "domain_expiry_30d";
  return null;
}

/**
 * Cron job to check for expiring domains and send email notifications.
 * Runs daily at 9:00 AM UTC.
 */
export const checkDomainExpiry = inngest.createFunction(
  {
    id: "check-domain-expiry",
    retries: 3,
    // Run only one instance at a time
    concurrency: {
      limit: 1,
    },
  },
  // Run every day at 9:00 AM UTC
  { cron: "0 9 * * *" },
  async ({ step, logger: inngestLogger }) => {
    inngestLogger.info("Starting domain expiry check");

    // Get all verified tracked domains with expiration dates
    const trackedDomains = await step.run("fetch-tracked-domains", async () => {
      return await getVerifiedTrackedDomainsWithExpiry();
    });

    inngestLogger.info(`Found ${trackedDomains.length} tracked domains`);

    // Process each domain
    const results = {
      total: trackedDomains.length,
      notificationsSent: 0,
      skipped: 0,
      errors: 0,
    };

    for (const domain of trackedDomains) {
      // Skip if no expiration date
      if (!domain.expirationDate) {
        results.skipped++;
        continue;
      }

      // Skip if notifications disabled
      if (!domain.notifyDomainExpiry) {
        results.skipped++;
        continue;
      }

      const daysRemaining = differenceInDays(domain.expirationDate, new Date());

      // Skip if not within any notification threshold
      const notificationType = getNotificationType(daysRemaining);
      if (!notificationType) {
        continue;
      }

      // Check if this notification was already sent
      const alreadySent = await step.run(
        `check-sent-${domain.id}-${notificationType}`,
        async () => {
          return await hasNotificationBeenSent(domain.id, notificationType);
        },
      );

      if (alreadySent) {
        results.skipped++;
        continue;
      }

      // Send notification email
      // We've already checked domain.expirationDate is not null above
      const expDate = domain.expirationDate;
      const sent = await step.run(`send-email-${domain.id}`, async () => {
        // Ensure expirationDate is a Date object (may be string or Date)
        const expirationDateObj = new Date(expDate);

        return await sendExpiryNotification({
          trackedDomainId: domain.id,
          domainName: domain.domainName,
          userName: domain.userName,
          userEmail: domain.userEmail,
          expirationDate: expirationDateObj,
          daysRemaining,
          notificationType,
        });
      });

      if (sent) {
        results.notificationsSent++;
      } else {
        results.errors++;
      }
    }

    inngestLogger.info("Domain expiry check complete", results);
    return results;
  },
);

async function sendExpiryNotification({
  trackedDomainId,
  domainName,
  userName,
  userEmail,
  expirationDate,
  daysRemaining,
  notificationType,
}: {
  trackedDomainId: string;
  domainName: string;
  userName: string;
  userEmail: string;
  expirationDate: Date;
  daysRemaining: number;
  notificationType: NotificationType;
}): Promise<boolean> {
  if (!resend) {
    logger.warn("Resend not configured, skipping email", { domainName });
    return false;
  }

  try {
    const dashboardUrl = `${BASE_URL}/dashboard`;

    // Render the email
    const emailHtml = await render(
      DomainExpiryEmail({
        userName: userName.split(" ")[0] || "there",
        domainName,
        expirationDate: format(expirationDate, "MMMM d, yyyy"),
        daysRemaining,
        dashboardUrl,
      }) as React.ReactElement,
    );

    // Send the email
    const { data, error } = await resend.emails.send({
      from: `DomainStack <${RESEND_FROM_EMAIL}>`,
      to: userEmail,
      subject: `${daysRemaining <= 7 ? "⚠️ " : ""}${domainName} expires in ${daysRemaining} day${daysRemaining === 1 ? "" : "s"}`,
      html: emailHtml,
    });

    if (error) {
      logger.error("Failed to send expiry email", error, {
        domainName,
        userEmail,
      });
      return false;
    }

    logger.info("Sent expiry notification", {
      domainName,
      userEmail,
      emailId: data?.id,
      daysRemaining,
    });

    // Record that this notification was sent
    await createNotification({
      trackedDomainId,
      type: notificationType,
    });

    return true;
  } catch (err) {
    logger.error("Error sending expiry notification", err, {
      domainName,
      userEmail,
    });
    return false;
  }
}

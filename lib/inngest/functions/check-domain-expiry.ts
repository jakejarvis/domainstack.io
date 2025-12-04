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

// Notification thresholds in days (ordered from most to least urgent)
const NOTIFICATION_THRESHOLDS = [1, 7, 14, 30] as const;
type ThresholdDays = (typeof NOTIFICATION_THRESHOLDS)[number];

const THRESHOLD_TO_TYPE: Record<ThresholdDays, NotificationType> = {
  1: "domain_expiry_1d",
  7: "domain_expiry_7d",
  14: "domain_expiry_14d",
  30: "domain_expiry_30d",
};

function getNotificationType(daysRemaining: number): NotificationType | null {
  for (const threshold of NOTIFICATION_THRESHOLDS) {
    if (daysRemaining <= threshold) {
      return THRESHOLD_TO_TYPE[threshold];
    }
  }
  return null;
}

/**
 * Generate a stable idempotency key for Resend.
 * This ensures that if a step retries, Resend won't send duplicate emails.
 */
function generateIdempotencyKey(
  trackedDomainId: string,
  notificationType: NotificationType,
): string {
  return `${trackedDomainId}:${notificationType}`;
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
        results.skipped++;
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

  // Generate a stable idempotency key BEFORE any operations
  // This ensures retries use the same key and Resend won't send duplicates
  const idempotencyKey = generateIdempotencyKey(
    trackedDomainId,
    notificationType,
  );

  try {
    // Step 1: Create the notification record first (upsert with onConflictDoNothing)
    // This acts as a lock - if we crash after this but before email sends,
    // the next retry will still have this record, and hasNotificationBeenSent
    // will return true (preventing re-entry to this function)
    // However, if this step succeeds but email fails, Resend's idempotency
    // key will prevent duplicate sends on retry
    const notificationRecord = await createNotification({
      trackedDomainId,
      type: notificationType,
    });

    // If notification was already recorded (duplicate), skip sending
    // This happens when the record exists from a previous partial run
    if (!notificationRecord) {
      logger.debug("Notification already recorded, checking if email sent", {
        trackedDomainId,
        notificationType,
      });
      // The notification exists - email may or may not have been sent
      // Resend's idempotency key will handle deduplication if we proceed
    }

    const dashboardUrl = `${BASE_URL}/dashboard`;

    // Step 2: Render the email
    const emailHtml = await render(
      DomainExpiryEmail({
        userName: userName.split(" ")[0] || "there",
        domainName,
        expirationDate: format(expirationDate, "MMMM d, yyyy"),
        daysRemaining,
        dashboardUrl,
      }) as React.ReactElement,
    );

    // Step 3: Send the email with idempotency key
    // If this request fails and retries with the same idempotencyKey,
    // Resend will return the original response without sending again
    const { data, error } = await resend.emails.send(
      {
        from: `DomainStack <${RESEND_FROM_EMAIL}>`,
        to: userEmail,
        subject: `${daysRemaining <= 7 ? "⚠️ " : ""}${domainName} expires in ${daysRemaining} day${daysRemaining === 1 ? "" : "s"}`,
        html: emailHtml,
      },
      {
        idempotencyKey,
      },
    );

    if (error) {
      logger.error("Failed to send expiry email", error, {
        domainName,
        userEmail,
        idempotencyKey,
      });
      // Don't return false here - the notification record is already created
      // and idempotency key ensures no duplicates on retry
      // Throwing will cause Inngest to retry the step
      throw new Error(`Resend error: ${error.message}`);
    }

    logger.info("Sent expiry notification", {
      domainName,
      userEmail,
      emailId: data?.id,
      daysRemaining,
      idempotencyKey,
    });

    return true;
  } catch (err) {
    logger.error("Error sending expiry notification", err, {
      domainName,
      userEmail,
      idempotencyKey,
    });
    // Re-throw to trigger Inngest retry
    // The idempotency key ensures Resend won't send duplicates
    throw err;
  }
}

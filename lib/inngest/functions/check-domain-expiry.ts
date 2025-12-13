import "server-only";

import { differenceInDays, format } from "date-fns";
import { DomainExpiryEmail } from "@/emails/domain-expiry";
import {
  clearDomainExpiryNotifications,
  createNotification,
  hasNotificationBeenSent,
  updateNotificationResendId,
} from "@/lib/db/repos/notifications";
import { getVerifiedTrackedDomainsWithExpiry } from "@/lib/db/repos/tracked-domains";
import { getOrCreateUserNotificationPreferences } from "@/lib/db/repos/user-notification-preferences";
import { inngest } from "@/lib/inngest/client";
import { createLogger } from "@/lib/logger/server";
import {
  generateIdempotencyKey,
  getDomainExpiryNotificationType,
  type NotificationType,
} from "@/lib/notifications";
import { sendPrettyEmail } from "@/lib/resend";

const logger = createLogger({ source: "check-domain-expiry" });

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
      renewalsDetected: 0,
    };

    // Max threshold is 30 days - if domain has more days remaining, it may have been renewed
    const MAX_THRESHOLD_DAYS = 30;

    for (const domain of trackedDomains) {
      // Skip if no expiration date
      if (!domain.expirationDate) {
        results.skipped++;
        continue;
      }

      const daysRemaining = differenceInDays(domain.expirationDate, new Date());

      // Detect domain renewal: if expiration is beyond max threshold,
      // clear any existing notifications so we can send fresh ones for the new cycle
      if (daysRemaining > MAX_THRESHOLD_DAYS) {
        const cleared = await step.run(
          `clear-renewed-${domain.id}`,
          async () => {
            return await clearDomainExpiryNotifications(domain.id);
          },
        );
        if (cleared > 0) {
          results.renewalsDetected++;
        }
        results.skipped++;
        continue;
      }

      // Skip if not within any notification threshold
      const notificationType = getDomainExpiryNotificationType(daysRemaining);
      if (!notificationType) {
        results.skipped++;
        continue;
      }

      // Check notification preferences (per-domain override > global)
      const shouldNotify = await step.run(
        `check-prefs-${domain.id}`,
        async () => {
          // Check per-domain override first
          if (domain.notificationOverrides.domainExpiry !== undefined) {
            return domain.notificationOverrides.domainExpiry;
          }
          // Fall back to global preferences
          const globalPrefs = await getOrCreateUserNotificationPreferences(
            domain.userId,
          );
          return globalPrefs.domainExpiry;
        },
      );

      if (!shouldNotify) {
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
      const expDate = domain.expirationDate;
      const registrar = domain.registrar;
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
          registrar: registrar ?? undefined,
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
  registrar,
  notificationType,
}: {
  trackedDomainId: string;
  domainName: string;
  userName: string;
  userEmail: string;
  expirationDate: Date;
  daysRemaining: number;
  registrar?: string;
  notificationType: NotificationType;
}): Promise<boolean> {
  // Generate a stable idempotency key BEFORE any operations
  // This ensures retries use the same key and Resend won't send duplicates
  const idempotencyKey = generateIdempotencyKey(
    trackedDomainId,
    notificationType,
  );

  try {
    // Create the notification record first (upsert with onConflictDoNothing)
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

    // Send the email with idempotency key
    // If this request fails and retries with the same idempotencyKey,
    // Resend will return the original response without sending again
    const { data, error } = await sendPrettyEmail(
      {
        to: userEmail,
        subject: `${daysRemaining <= 7 ? "⚠️ " : ""}${domainName} expires in ${daysRemaining} day${daysRemaining === 1 ? "" : "s"}`,
        react: DomainExpiryEmail({
          userName: userName.split(" ")[0] || "there",
          domainName,
          expirationDate: format(expirationDate, "MMMM d, yyyy"),
          daysRemaining,
          registrar,
        }),
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

    // Store Resend ID for troubleshooting
    if (data?.id) {
      await updateNotificationResendId(
        trackedDomainId,
        notificationType,
        data.id,
      );
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

import "server-only";

import { render } from "@react-email/components";
import { differenceInDays } from "date-fns";
import type React from "react";
import { VerificationFailingEmail } from "@/emails/verification-failing";
import { VerificationRevokedEmail } from "@/emails/verification-revoked";
import { BASE_URL } from "@/lib/constants";
import {
  createNotification,
  hasNotificationBeenSent,
  updateNotificationResendId,
} from "@/lib/db/repos/notifications";
import {
  getPendingDomainsForAutoVerification,
  getVerifiedDomainsForReverification,
  markVerificationFailing,
  markVerificationSuccessful,
  revokeVerification,
  type TrackedDomainForReverification,
  verifyTrackedDomain,
} from "@/lib/db/repos/tracked-domains";
import { getOrCreateUserNotificationPreferences } from "@/lib/db/repos/user-notification-preferences";
import { inngest } from "@/lib/inngest/client";
import { createLogger } from "@/lib/logger/server";
import { RESEND_FROM_EMAIL, resend } from "@/lib/resend";
import {
  tryAllVerificationMethods,
  verifyDomainOwnership,
} from "@/server/services/verification";

const logger = createLogger({ source: "reverify-domains" });

// Grace period before revoking verification (in days)
const GRACE_PERIOD_DAYS = 7;

/**
 * Check if verification status notifications should be sent for a domain.
 * Checks per-domain override first, then falls back to global user preference.
 */
async function shouldNotifyVerificationStatus(
  domain: TrackedDomainForReverification,
): Promise<boolean> {
  // Check per-domain override first
  if (domain.notificationOverrides.verificationStatus !== undefined) {
    return domain.notificationOverrides.verificationStatus;
  }
  // Fall back to global user preferences
  const globalPrefs = await getOrCreateUserNotificationPreferences(
    domain.userId,
  );
  return globalPrefs.verificationStatus;
}

/**
 * Cron job to re-verify domain ownership and auto-verify pending domains.
 * Runs daily at 4:00 AM UTC.
 *
 * This function handles two scenarios:
 * 1. Re-verification of already verified domains (with grace period for failures)
 * 2. Auto-verification of pending domains (user added TXT record but never clicked verify)
 *
 * Grace period workflow for verified domains:
 * - Day 0: Verification fails → mark as 'failing', send warning email
 * - Day 7: Still failing → revoke verification, send final email
 */
export const reverifyDomains = inngest.createFunction(
  {
    id: "reverify-domains",
    retries: 3,
    // Run only one instance at a time
    concurrency: {
      limit: 1,
    },
  },
  // Run every day at 4:00 AM UTC
  { cron: "0 4 * * *" },
  async ({ step, logger: inngestLogger }) => {
    inngestLogger.info("Starting domain verification job");

    // ========================================================================
    // Part 1: Auto-verify pending domains
    // ========================================================================
    const pendingDomains = await step.run("fetch-pending-domains", async () => {
      return await getPendingDomainsForAutoVerification();
    });

    inngestLogger.info(
      `Found ${pendingDomains.length} pending domains to check`,
    );

    const pendingResults = {
      total: pendingDomains.length,
      autoVerified: 0,
      stillPending: 0,
      errors: 0,
    };

    for (const domain of pendingDomains) {
      try {
        // Try all verification methods since we don't know which one the user chose
        const result = await step.run(`auto-verify-${domain.id}`, async () => {
          return await tryAllVerificationMethods(
            domain.domainName,
            domain.verificationToken,
          );
        });

        if (result.verified && result.method) {
          // Auto-verification successful!
          const verifiedMethod = result.method;
          await step.run(`mark-auto-verified-${domain.id}`, async () => {
            await verifyTrackedDomain(domain.id, verifiedMethod);
          });
          pendingResults.autoVerified++;

          logger.info("Auto-verified pending domain", {
            domainId: domain.id,
            domainName: domain.domainName,
            method: result.method,
          });
        } else {
          pendingResults.stillPending++;
        }
      } catch (err) {
        logger.error("Error auto-verifying pending domain", err, {
          domainId: domain.id,
          domainName: domain.domainName,
        });
        pendingResults.errors++;
      }
    }

    // ========================================================================
    // Part 2: Re-verify already verified domains
    // ========================================================================
    const verifiedDomains = await step.run(
      "fetch-verified-domains",
      async () => {
        return await getVerifiedDomainsForReverification();
      },
    );

    inngestLogger.info(
      `Found ${verifiedDomains.length} verified domains to re-verify`,
    );

    const verifiedResults = {
      total: verifiedDomains.length,
      verified: 0,
      failing: 0,
      revoked: 0,
      errors: 0,
    };

    for (const domain of verifiedDomains) {
      try {
        const result = await step.run(`reverify-${domain.id}`, async () => {
          return await verifyDomainOwnership(
            domain.domainName,
            domain.verificationToken,
            domain.verificationMethod,
          );
        });

        if (result.verified) {
          // Verification successful
          await step.run(`mark-verified-${domain.id}`, async () => {
            await markVerificationSuccessful(domain.id);
          });
          verifiedResults.verified++;
        } else {
          // Verification failed - convert serialized date back to Date
          const domainWithDate = {
            ...domain,
            verificationFailedAt: domain.verificationFailedAt
              ? new Date(domain.verificationFailedAt)
              : null,
          };
          await step.run(`handle-failure-${domain.id}`, async () => {
            await handleVerificationFailure(domainWithDate);
          });
          verifiedResults.failing++;
        }
      } catch (err) {
        logger.error("Error re-verifying domain", err, {
          domainId: domain.id,
          domainName: domain.domainName,
        });
        verifiedResults.errors++;
      }
    }

    const results = {
      pending: pendingResults,
      verified: verifiedResults,
    };

    inngestLogger.info("Domain verification job complete", results);
    return results;
  },
);

/**
 * Handle a verification failure.
 * If within grace period, mark as failing and send warning.
 * If grace period exceeded, revoke verification.
 */
async function handleVerificationFailure(
  domain: TrackedDomainForReverification,
) {
  const now = new Date();

  if (domain.verificationStatus === "verified") {
    // First failure - mark as failing and send warning
    await markVerificationFailing(domain.id);

    const shouldNotify = await shouldNotifyVerificationStatus(domain);
    if (shouldNotify) {
      await sendVerificationFailingEmail(domain);
    }

    logger.info("Marked domain as failing verification", {
      domainId: domain.id,
      domainName: domain.domainName,
    });
  } else if (domain.verificationStatus === "failing") {
    // Already failing - check if grace period exceeded
    const failedAt = domain.verificationFailedAt;
    if (!failedAt) {
      // Shouldn't happen, but mark failing time now
      await markVerificationFailing(domain.id);
      return;
    }

    const daysFailing = differenceInDays(now, failedAt);

    if (daysFailing >= GRACE_PERIOD_DAYS) {
      // Grace period exceeded - revoke verification
      await revokeVerification(domain.id);

      const shouldNotify = await shouldNotifyVerificationStatus(domain);
      if (shouldNotify) {
        await sendVerificationRevokedEmail(domain);
      }

      logger.info("Revoked domain verification after grace period", {
        domainId: domain.id,
        domainName: domain.domainName,
        daysFailing,
      });
    } else {
      logger.debug("Domain still in grace period", {
        domainId: domain.id,
        domainName: domain.domainName,
        daysFailing,
        daysRemaining: GRACE_PERIOD_DAYS - daysFailing,
      });
    }
  }
}

/**
 * Send email when verification first starts failing.
 */
async function sendVerificationFailingEmail(
  domain: TrackedDomainForReverification,
): Promise<boolean> {
  if (!resend) {
    logger.warn("Resend not configured, skipping email", {
      domainName: domain.domainName,
    });
    return false;
  }

  // Check if we've already sent this notification
  const alreadySent = await hasNotificationBeenSent(
    domain.id,
    "verification_failing",
  );
  if (alreadySent) {
    return false;
  }

  try {
    const dashboardUrl = `${BASE_URL}/dashboard`;

    const emailHtml = await render(
      VerificationFailingEmail({
        userName: domain.userName.split(" ")[0] || "there",
        domainName: domain.domainName,
        verificationMethod: domain.verificationMethod,
        gracePeriodDays: GRACE_PERIOD_DAYS,
        dashboardUrl,
      }) as React.ReactElement,
    );

    const { data, error } = await resend.emails.send({
      from: `Domainstack <${RESEND_FROM_EMAIL}>`,
      to: domain.userEmail,
      subject: `⚠️ Verification failing for ${domain.domainName}`,
      html: emailHtml,
    });

    if (error) {
      logger.error("Failed to send verification failing email", error, {
        domainName: domain.domainName,
        userEmail: domain.userEmail,
      });
      return false;
    }

    logger.info("Sent verification failing notification", {
      domainName: domain.domainName,
      userEmail: domain.userEmail,
      emailId: data?.id,
    });

    await createNotification({
      trackedDomainId: domain.id,
      type: "verification_failing",
    });

    // Store Resend ID for troubleshooting
    if (data?.id) {
      await updateNotificationResendId(
        domain.id,
        "verification_failing",
        data.id,
      );
    }

    return true;
  } catch (err) {
    logger.error("Error sending verification failing email", err, {
      domainName: domain.domainName,
      userEmail: domain.userEmail,
    });
    return false;
  }
}

/**
 * Send email when verification is revoked.
 */
async function sendVerificationRevokedEmail(
  domain: TrackedDomainForReverification,
): Promise<boolean> {
  if (!resend) {
    logger.warn("Resend not configured, skipping email", {
      domainName: domain.domainName,
    });
    return false;
  }

  // Check if we've already sent this notification
  const alreadySent = await hasNotificationBeenSent(
    domain.id,
    "verification_revoked",
  );
  if (alreadySent) {
    return false;
  }

  try {
    const dashboardUrl = `${BASE_URL}/dashboard`;

    const emailHtml = await render(
      VerificationRevokedEmail({
        userName: domain.userName.split(" ")[0] || "there",
        domainName: domain.domainName,
        dashboardUrl,
      }) as React.ReactElement,
    );

    const { data, error } = await resend.emails.send({
      from: `Domainstack <${RESEND_FROM_EMAIL}>`,
      to: domain.userEmail,
      subject: `❌ Verification revoked for ${domain.domainName}`,
      html: emailHtml,
    });

    if (error) {
      logger.error("Failed to send verification revoked email", error, {
        domainName: domain.domainName,
        userEmail: domain.userEmail,
      });
      return false;
    }

    logger.info("Sent verification revoked notification", {
      domainName: domain.domainName,
      userEmail: domain.userEmail,
      emailId: data?.id,
    });

    await createNotification({
      trackedDomainId: domain.id,
      type: "verification_revoked",
    });

    // Store Resend ID for troubleshooting
    if (data?.id) {
      await updateNotificationResendId(
        domain.id,
        "verification_revoked",
        data.id,
      );
    }

    return true;
  } catch (err) {
    logger.error("Error sending verification revoked email", err, {
      domainName: domain.domainName,
      userEmail: domain.userEmail,
    });
    return false;
  }
}

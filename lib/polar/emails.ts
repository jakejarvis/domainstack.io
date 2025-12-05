import "server-only";

import { render } from "@react-email/components";
import { format } from "date-fns";
import type React from "react";
import ProUpgradeSuccessEmail from "@/emails/pro-upgrade-success";
import ProWelcomeEmail from "@/emails/pro-welcome";
import SubscriptionCancelingEmail from "@/emails/subscription-canceling";
import SubscriptionExpiredEmail from "@/emails/subscription-expired";
import { BASE_URL } from "@/lib/constants";
import { getUserById } from "@/lib/db/repos/users";
import { createLogger } from "@/lib/logger/server";
import { RESEND_FROM_EMAIL, resend } from "@/lib/resend";

const logger = createLogger({ source: "polar-emails" });

/**
 * Send Pro upgrade success email.
 * Called when a subscription becomes active (payment confirmed).
 */
export async function sendProUpgradeEmail(userId: string): Promise<boolean> {
  if (!resend) {
    logger.warn("Resend not configured, skipping email", { userId });
    return false;
  }

  const user = await getUserById(userId);
  if (!user) {
    logger.error("User not found for upgrade email", { userId });
    return false;
  }

  try {
    const dashboardUrl = `${BASE_URL}/dashboard`;
    const firstName = user.name.split(" ")[0] || "there";

    const emailHtml = await render(
      ProUpgradeSuccessEmail({
        userName: firstName,
        dashboardUrl,
      }) as React.ReactElement,
    );

    const { data, error } = await resend.emails.send({
      from: `Domainstack <${RESEND_FROM_EMAIL}>`,
      to: user.email,
      subject: "🎉 Welcome to Domainstack Pro!",
      html: emailHtml,
    });

    if (error) {
      logger.error("Failed to send Pro upgrade email", error, { userId });
      return false;
    }

    logger.info("Sent Pro upgrade email", { userId, emailId: data?.id });

    // Also send the welcome/tips email
    await sendProWelcomeEmail(userId, user.name, user.email);

    return true;
  } catch (err) {
    logger.error("Error sending Pro upgrade email", err, { userId });
    return false;
  }
}

/**
 * Send Pro welcome/tips email (sent after upgrade success).
 */
async function sendProWelcomeEmail(
  userId: string,
  userName: string,
  userEmail: string,
): Promise<boolean> {
  if (!resend) {
    return false;
  }

  try {
    const dashboardUrl = `${BASE_URL}/dashboard`;
    const firstName = userName.split(" ")[0] || "there";

    const emailHtml = await render(
      ProWelcomeEmail({
        userName: firstName,
        dashboardUrl,
      }) as React.ReactElement,
    );

    const { data, error } = await resend.emails.send({
      from: `Domainstack <${RESEND_FROM_EMAIL}>`,
      to: userEmail,
      subject: "Getting the most out of Domainstack Pro",
      html: emailHtml,
    });

    if (error) {
      logger.error("Failed to send Pro welcome email", error, { userId });
      return false;
    }

    logger.info("Sent Pro welcome email", { userId, emailId: data?.id });

    return true;
  } catch (err) {
    logger.error("Error sending Pro welcome email", err, { userId });
    return false;
  }
}

/**
 * Send subscription canceling email.
 * Called when user cancels but still has access until period ends.
 */
export async function sendSubscriptionCancelingEmail(
  userId: string,
  endsAt: Date,
): Promise<boolean> {
  if (!resend) {
    logger.warn("Resend not configured, skipping email", { userId });
    return false;
  }

  const user = await getUserById(userId);
  if (!user) {
    logger.error("User not found for canceling email", { userId });
    return false;
  }

  try {
    const dashboardUrl = `${BASE_URL}/dashboard`;
    const firstName = user.name.split(" ")[0] || "there";
    const endDate = format(endsAt, "MMMM d, yyyy");

    const emailHtml = await render(
      SubscriptionCancelingEmail({
        userName: firstName,
        endDate,
        dashboardUrl,
      }) as React.ReactElement,
    );

    const { data, error } = await resend.emails.send({
      from: `Domainstack <${RESEND_FROM_EMAIL}>`,
      to: user.email,
      subject: `Your Pro subscription ends on ${endDate}`,
      html: emailHtml,
    });

    if (error) {
      logger.error("Failed to send subscription canceling email", error, {
        userId,
      });
      return false;
    }

    logger.info("Sent subscription canceling email", {
      userId,
      emailId: data?.id,
      endsAt: endsAt.toISOString(),
    });

    return true;
  } catch (err) {
    logger.error("Error sending subscription canceling email", err, { userId });
    return false;
  }
}

/**
 * Send subscription expired email.
 * Called when subscription is revoked (access ended).
 */
export async function sendSubscriptionExpiredEmail(
  userId: string,
  archivedCount: number,
): Promise<boolean> {
  if (!resend) {
    logger.warn("Resend not configured, skipping email", { userId });
    return false;
  }

  const user = await getUserById(userId);
  if (!user) {
    logger.error("User not found for expired email", { userId });
    return false;
  }

  try {
    const dashboardUrl = `${BASE_URL}/dashboard`;
    const firstName = user.name.split(" ")[0] || "there";

    const emailHtml = await render(
      SubscriptionExpiredEmail({
        userName: firstName,
        archivedCount,
        dashboardUrl,
      }) as React.ReactElement,
    );

    const { data, error } = await resend.emails.send({
      from: `Domainstack <${RESEND_FROM_EMAIL}>`,
      to: user.email,
      subject: "Your Pro subscription has ended",
      html: emailHtml,
    });

    if (error) {
      logger.error("Failed to send subscription expired email", error, {
        userId,
      });
      return false;
    }

    logger.info("Sent subscription expired email", {
      userId,
      emailId: data?.id,
      archivedCount,
    });

    return true;
  } catch (err) {
    logger.error("Error sending subscription expired email", err, { userId });
    return false;
  }
}

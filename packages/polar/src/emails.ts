import { getUserById } from "@domainstack/db/queries";
import { sendEmail } from "@domainstack/email";
import ProUpgradeSuccessEmail from "@domainstack/email/templates/pro-upgrade-success";
import SubscriptionCancelingEmail from "@domainstack/email/templates/subscription-canceling";
import SubscriptionExpiredEmail from "@domainstack/email/templates/subscription-expired";
import { logger } from "@domainstack/logger";
import { format } from "date-fns";

const baseUrl = process.env.NEXT_PUBLIC_BASE_URL as string;

/**
 * Send a pro upgrade success email to a user.
 */
export async function sendProUpgradeEmail(userId: string): Promise<void> {
  const user = await getUserById(userId);
  if (!user) {
    logger.warn({ userId }, "User not found, skipping pro upgrade email");
    return;
  }

  await sendEmail(
    {
      to: user.email,
      subject: "Welcome to Domainstack Pro!",
      react: ProUpgradeSuccessEmail({
        userName: user.name || "there",
        baseUrl,
      }),
    },
    { baseUrl },
  );
}

/**
 * Send a subscription canceling email to a user.
 */
export async function sendSubscriptionCancelingEmail(
  userId: string,
  periodEnd: Date,
): Promise<void> {
  const user = await getUserById(userId);
  if (!user) {
    logger.warn({ userId }, "User not found, skipping canceling email");
    return;
  }

  await sendEmail(
    {
      to: user.email,
      subject: "Your Pro subscription is ending",
      react: SubscriptionCancelingEmail({
        userName: user.name || "there",
        endDate: format(periodEnd, "MMMM d, yyyy"),
        baseUrl,
      }),
    },
    { baseUrl },
  );
}

/**
 * Send a subscription expired email to a user.
 */
export async function sendSubscriptionExpiredEmail(
  userId: string,
  archivedCount: number,
): Promise<void> {
  const user = await getUserById(userId);
  if (!user) {
    logger.warn({ userId }, "User not found, skipping expired email");
    return;
  }

  await sendEmail(
    {
      to: user.email,
      subject: "Your Pro subscription has ended",
      react: SubscriptionExpiredEmail({
        userName: user.name || "there",
        archivedCount,
        baseUrl,
      }),
    },
    { baseUrl },
  );
}

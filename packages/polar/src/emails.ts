import { getUserById } from "@domainstack/db/queries/users";
import { sendEmail } from "@domainstack/email";
import ProUpgradeSuccessEmail from "@domainstack/email/templates/pro-upgrade-success";
import SubscriptionCancelingEmail from "@domainstack/email/templates/subscription-canceling";
import SubscriptionExpiredEmail from "@domainstack/email/templates/subscription-expired";
import { createLogger } from "@domainstack/logger";
import { formatDateLong } from "@domainstack/utils/date";

const logger = createLogger({ source: "polar/emails" });

const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || "https://domainstack.io";

/**
 * Send a pro upgrade success email to a user.
 */
export async function sendProUpgradeEmail(userId: string): Promise<void> {
  const user = await getUserById(userId);
  if (!user) {
    logger.warn({ userId }, "User not found, skipping pro upgrade email");
    return;
  }

  const { error } = await sendEmail(
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
  if (error) {
    throw new Error(`Resend error sending pro upgrade email: ${error.name} - ${error.message}`);
  }
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

  const { error } = await sendEmail(
    {
      to: user.email,
      subject: "Your Pro subscription is ending",
      react: SubscriptionCancelingEmail({
        userName: user.name || "there",
        endDate: formatDateLong(periodEnd),
        baseUrl,
      }),
    },
    { baseUrl },
  );
  if (error) {
    throw new Error(
      `Resend error sending subscription canceling email: ${error.name} - ${error.message}`,
    );
  }
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

  const { error } = await sendEmail(
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
  if (error) {
    throw new Error(
      `Resend error sending subscription expired email: ${error.name} - ${error.message}`,
    );
  }
}

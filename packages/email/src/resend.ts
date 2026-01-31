import {
  RESEND_LOGO_CONTENT_ID,
  RESEND_LOGO_PATH,
} from "@domainstack/constants";
import { logger } from "@domainstack/logger";
import { Resend } from "resend";

const apiKey = process.env.RESEND_API_KEY;

if (!apiKey) {
  logger.warn(
    "RESEND_API_KEY is not set. Email notifications will not be sent.",
  );
}

const resend = apiKey ? new Resend(apiKey) : null;

/**
 * Options for sending email.
 */
export type SendEmailOptions = {
  /** Base URL for the application (used for logo attachment) */
  baseUrl: string;
  /** Idempotency key for deduplication */
  idempotencyKey?: string;
};

/**
 * Send an email with automatic logo attachment and from field.
 *
 * Automatically includes:
 * - Logo attachment via remote URL (baseUrl/apple-icon.png)
 * - From field: "Domainstack <RESEND_FROM_EMAIL>"
 *
 * @param params - Email parameters (omit 'from' field)
 * @param options - Options including baseUrl for logo attachment
 * @returns Promise with Resend response
 */
export async function sendEmail(
  params: Omit<Parameters<typeof Resend.prototype.emails.send>[0], "from">,
  options: SendEmailOptions,
) {
  if (!resend) {
    throw new Error("Resend is not configured");
  }

  const logoAttachment = {
    path: `${options.baseUrl}${RESEND_LOGO_PATH}`,
    filename: "logo.png",
    contentId: RESEND_LOGO_CONTENT_ID,
  };

  const existingAttachments = params.attachments || [];

  return resend.emails.send(
    {
      from: `Domainstack <${process.env.RESEND_FROM_EMAIL || "alerts@domainstack.io"}>`,
      ...params,
      attachments: [...existingAttachments, logoAttachment],
    } as Parameters<typeof Resend.prototype.emails.send>[0],
    options.idempotencyKey
      ? { idempotencyKey: options.idempotencyKey }
      : undefined,
  );
}

/**
 * Add a contact to Resend.
 *
 * @param email - The email address of the contact.
 * @param fullName - The full name of the contact.
 */
export async function addContact(
  email: string,
  fullName: string | null | undefined,
) {
  if (!resend) {
    throw new Error("Resend is not configured");
  }

  // Parse name into first/last (best-effort)
  const nameParts = fullName?.trim().split(/\s+/) ?? [];
  const [firstName] = nameParts;
  const lastName =
    nameParts.length > 1 ? nameParts.slice(1).join(" ") : undefined;

  return resend.contacts.create({
    email: email,
    firstName,
    lastName,
    unsubscribed: false,
  });
}

/**
 * Remove a contact from Resend.
 *
 * @param email - The email address of the contact.
 */
export async function removeContact(email: string) {
  if (!resend) {
    throw new Error("Resend is not configured");
  }

  return resend.contacts.remove({ email });
}

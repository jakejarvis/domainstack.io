import "server-only";

import { Resend } from "resend";
import {
  RESEND_FROM_EMAIL,
  RESEND_LOGO_CONTENT_ID,
  RESEND_LOGO_REMOTE_URL,
} from "@/lib/constants/email";
import { logger } from "@/lib/logger/server";

const apiKey = process.env.RESEND_API_KEY;

if (!apiKey) {
  logger.warn(
    "RESEND_API_KEY is not set. Email notifications will not be sent.",
  );
}

export const resend = apiKey ? new Resend(apiKey) : null;

/**
 * Send an email with automatic logo attachment and from field.
 *
 * Automatically includes:
 * - Logo attachment via remote URL (BASE_URL/apple-icon.png)
 * - From field: "Domainstack <RESEND_FROM_EMAIL>"
 *
 * @param params - Email parameters (omit 'from' field)
 * @param options - Optional Resend options (e.g., idempotencyKey)
 * @returns Promise with Resend response
 */
export async function sendEmail(
  params: Omit<Parameters<typeof Resend.prototype.emails.send>[0], "from">,
  options?: Parameters<typeof Resend.prototype.emails.send>[1],
) {
  if (!resend) {
    throw new Error("Resend is not configured");
  }

  const logoAttachment = {
    path: RESEND_LOGO_REMOTE_URL,
    filename: "logo.png",
    contentId: RESEND_LOGO_CONTENT_ID,
  };

  const existingAttachments = params.attachments || [];

  return resend.emails.send(
    {
      from: `Domainstack <${RESEND_FROM_EMAIL}>`,
      ...params,
      attachments: [...existingAttachments, logoAttachment],
    } as Parameters<typeof Resend.prototype.emails.send>[0],
    options,
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
  const firstName = nameParts[0];
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

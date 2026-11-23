import { Resend } from "resend";

import { RESEND_LOGO_CONTENT_ID, RESEND_LOGO_PATH } from "@domainstack/constants";

const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;

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
    options.idempotencyKey ? { idempotencyKey: options.idempotencyKey } : undefined,
  );
}

/** Best-effort first/last split for Resend contacts. */
function splitName(fullName: string | null | undefined) {
  const nameParts = fullName?.trim().split(/\s+/) ?? [];
  const [firstName] = nameParts;
  const lastName = nameParts.length > 1 ? nameParts.slice(1).join(" ") : undefined;
  return { firstName, lastName };
}

/**
 * Add a contact to Resend.
 *
 * @param email - The email address of the contact.
 * @param fullName - The full name of the contact.
 */
export async function addContact(email: string, fullName: string | null | undefined) {
  if (!resend) {
    throw new Error("Resend is not configured");
  }

  return resend.contacts.create({
    email: email,
    ...splitName(fullName),
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

/**
 * Move a contact to a new address. Resend can't change a contact's email, so
 * this creates the new contact (keeping the old one's unsubscribe choice) and
 * then removes the old one. Any failure throws and leaves only the old contact
 * in place (a new contact created along the way is removed again): re-
 * subscribing someone who opted out, or keeping two contacts that both get
 * sends, would be worse than a stale address.
 */
export async function replaceContact(
  previousEmail: string,
  newEmail: string,
  fullName: string | null | undefined,
) {
  if (!resend) {
    throw new Error("Resend is not configured");
  }

  const previous = await resend.contacts.get({ email: previousEmail });
  if (previous.error && previous.error.name !== "not_found") {
    throw new Error(`failed to read Resend contact: ${previous.error.message}`);
  }

  const created = await resend.contacts.create({
    email: newEmail,
    ...splitName(fullName),
    unsubscribed: previous.data?.unsubscribed ?? false,
  });
  if (created.error) {
    throw new Error(`failed to create Resend contact: ${created.error.message}`);
  }

  if (!previous.data) return;
  const wasUnsubscribed = previous.data.unsubscribed;

  try {
    // An unsubscribe that landed on the old contact while the new one was being
    // created must survive the old contact's removal.
    const latest = await resend.contacts.get({ email: previousEmail });
    if (latest.error) {
      if (latest.error.name === "not_found") return;
      throw new Error(`failed to re-read Resend contact: ${latest.error.message}`);
    }
    if (latest.data.unsubscribed && !wasUnsubscribed) {
      const optedOut = await resend.contacts.update({ email: newEmail, unsubscribed: true });
      if (optedOut.error) {
        throw new Error(`failed to carry over Resend opt-out: ${optedOut.error.message}`);
      }
    }

    const removed = await resend.contacts.remove({ email: previousEmail });
    if (removed.error) {
      throw new Error(`failed to remove old Resend contact: ${removed.error.message}`);
    }
  } catch (err) {
    // Roll back to the old contact alone (it holds the current opt-out state),
    // rather than leave two contacts that would both receive sends.
    const rolledBack = await resend.contacts.remove({ email: newEmail });
    if (rolledBack.error) {
      // Can't delete it: at least stop it receiving sends. The old contact
      // still holds the real subscription state.
      await resend.contacts.update({ email: newEmail, unsubscribed: true });
    }
    throw err;
  }
}

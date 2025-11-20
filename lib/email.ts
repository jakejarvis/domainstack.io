import "server-only";

import { Resend } from "resend";

if (!process.env.RESEND_API_KEY) {
  throw new Error("RESEND_API_KEY is not set");
}

export const resend = new Resend(process.env.RESEND_API_KEY);

export const DEFAULT_FROM_EMAIL =
  process.env.RESEND_FROM_EMAIL ?? "Domainstack <no-reply@domainstack.io>";

/**
 * Send a domain alert email to a user
 */
export async function sendDomainAlertEmail(opts: {
  to: string;
  subject: string;
  html: string;
}) {
  await resend.emails.send({
    from: DEFAULT_FROM_EMAIL,
    to: opts.to,
    subject: opts.subject,
    html: opts.html,
  });
}

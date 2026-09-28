import { randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";

import { render } from "react-email";

import { RESEND_LOGO_CONTENT_ID, RESEND_LOGO_PATH } from "@domainstack/constants";
import { createLogger } from "@domainstack/logger";

const logger = createLogger({ source: "email/dev-outbox" });

/**
 * Outbox directory, relative to the working directory (the web app under
 * `next dev`). Kept out of `public/` so the dev server never serves emails,
 * which can contain confirmation links.
 */
const DEV_OUTBOX_DIR = ".dev-emails";

/**
 * Whether emails should go to the local outbox instead of Resend: only in
 * development, and only when Resend is not configured.
 */
export function shouldUseDevOutbox(): boolean {
  return process.env.NODE_ENV === "development" && !process.env.RESEND_API_KEY;
}

/**
 * Render an email to an HTML file under the web app's `.dev-emails/` and log
 * its path, so flows that send email can be exercised locally without a
 * Resend account.
 *
 * @returns A fake email ID in the same shape Resend returns
 */
export async function writeToDevOutbox(email: {
  to: string | string[];
  subject?: string;
  react?: React.ReactNode;
  html?: string;
  baseUrl: string;
}): Promise<{ id: string }> {
  const id = `dev-${randomUUID()}`;
  const slug = (email.subject ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 60);
  const filename = `${slug || "email"}-${id}.html`;

  const rendered = email.react ? await render(email.react) : (email.html ?? "");
  // Resend attaches the logo inline; point the preview at the hosted copy instead
  const html = rendered.replaceAll(
    `cid:${RESEND_LOGO_CONTENT_ID}`,
    `${email.baseUrl.replace(/\/$/, "")}${RESEND_LOGO_PATH}`,
  );

  const dir = path.join(process.cwd(), DEV_OUTBOX_DIR);
  const file = path.join(dir, filename);
  await mkdir(dir, { recursive: true });
  await writeFile(file, html);

  logger.info(
    { to: email.to, subject: email.subject, file: pathToFileURL(file).href },
    "Resend not configured, wrote email to local outbox",
  );

  return { id };
}

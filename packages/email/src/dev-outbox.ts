import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

import { render } from "react-email";

import { createLogger } from "@domainstack/logger";

const logger = createLogger({ source: "email/dev-outbox" });

/** Public path the outbox writes under; `next dev` serves it from `public/`. */
const DEV_OUTBOX_DIR = "_dev-emails";

/**
 * Whether emails should go to the local outbox instead of Resend: only in
 * development, and only when Resend is not configured.
 */
export function shouldUseDevOutbox(): boolean {
  return process.env.NODE_ENV === "development" && !process.env.RESEND_API_KEY;
}

/**
 * Render an email to an HTML file under the web app's `public/_dev-emails/`
 * and log a link to it, so flows that send email can be exercised locally
 * without a Resend account.
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
  const id = `dev-${Date.now()}`;
  const slug = (email.subject ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 60);
  const filename = `${id}-${slug || "email"}.html`;

  const html = email.react ? await render(email.react) : (email.html ?? "");

  // `next dev` runs with the web app as its working directory
  const dir = path.join(process.cwd(), "public", DEV_OUTBOX_DIR);
  await mkdir(dir, { recursive: true });
  await writeFile(path.join(dir, filename), html);

  logger.info(
    {
      to: email.to,
      subject: email.subject,
      url: `${email.baseUrl.replace(/\/$/, "")}/${DEV_OUTBOX_DIR}/${filename}`,
    },
    "Resend not configured, wrote email to local outbox",
  );

  return { id };
}

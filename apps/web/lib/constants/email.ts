import { BASE_URL } from "@/lib/constants/app";

/**
 * Email address used for sending notifications.
 * Defaults to alerts@domainstack.io if not configured.
 */
export const RESEND_FROM_EMAIL =
  process.env.RESEND_FROM_EMAIL || "alerts@domainstack.io";

/**
 * Logo content ID for embedded inline images.
 * Reference in email HTML via: <img src="cid:domainstack-logo" />
 */
export const RESEND_LOGO_CONTENT_ID = "domainstack-logo";

/**
 * Remote URL for the logo attachment.
 * Uses the apple-icon.png from the app directory.
 */
export const RESEND_LOGO_REMOTE_URL = `${BASE_URL}/apple-icon.png`;

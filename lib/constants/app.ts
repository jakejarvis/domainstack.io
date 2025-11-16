export const BASE_URL = process.env.NEXT_PUBLIC_VERCEL_PROJECT_PRODUCTION_URL
  ? `https://${process.env.NEXT_PUBLIC_VERCEL_PROJECT_PRODUCTION_URL}`
  : "http://localhost:3000";

export const USER_AGENT =
  process.env.EXTERNAL_USER_AGENT ||
  "domainstack.io/0.1 (+https://domainstack.io)";

export const REPOSITORY_SLUG = "jakejarvis/domainstack.io";

/**
 * Maximum number of domain suggestions/history items to show in the UI.
 */
export const MAX_HISTORY_ITEMS = 10;

/**
 * Runtime application constants (require process.env).
 * Pure constants are in @domainstack/constants.
 */

export const BASE_URL = process.env.NEXT_PUBLIC_VERCEL_PROJECT_PRODUCTION_URL
  ? `https://${process.env.NEXT_PUBLIC_VERCEL_PROJECT_PRODUCTION_URL}`
  : "http://localhost:3000";

export const USER_AGENT =
  process.env.EXTERNAL_USER_AGENT ||
  "domainstack.io/0.1 (+https://domainstack.io)";

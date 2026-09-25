import { timingSafeEqual } from "node:crypto";

/**
 * Whether a cron request carries `Authorization: Bearer $CRON_SECRET`.
 *
 * Fails closed: with `CRON_SECRET` unset or empty, every request is rejected
 * (a template-string comparison would otherwise accept `Bearer undefined`).
 */
export function isCronAuthorized(request: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;

  const received = Buffer.from(request.headers.get("Authorization") ?? "");
  const expected = Buffer.from(`Bearer ${secret}`);
  return received.length === expected.length && timingSafeEqual(received, expected);
}

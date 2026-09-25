/**
 * Day-count helpers shared by the expiry workflows and the UI that describes them.
 */

/**
 * Calculate the number of days remaining until a given date.
 *
 * @param expirationDate - The expiration date
 * @param now - The current date (defaults to new Date())
 * @returns Number of days remaining (negative if expired, `NaN` if the date
 *          cannot be parsed)
 */
export function calculateDaysRemaining(
  expirationDate: Date | string,
  now: Date = new Date(),
): number {
  const expDate = typeof expirationDate === "string" ? new Date(expirationDate) : expirationDate;

  const diffMs = expDate.getTime() - now.getTime();
  return Math.floor(diffMs / (1000 * 60 * 60 * 24));
}

/**
 * Calculate the number of whole days that have passed since a given date.
 *
 * The mirror of {@link calculateDaysRemaining}, for grace periods and other
 * "how long has this been true" counts. Both live here so a server-side
 * decision and the badge describing it can never round differently.
 *
 * @param since - The date to count from
 * @param now - The current date (defaults to new Date())
 * @returns Whole days elapsed (negative if `since` is in the future, `NaN` if
 *          the date cannot be parsed)
 */
export function calculateDaysElapsed(since: Date | string, now: Date = new Date()): number {
  return calculateDaysRemaining(now, typeof since === "string" ? new Date(since) : since);
}

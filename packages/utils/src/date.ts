function toDate(value: string | Date | number): Date {
  return value instanceof Date ? value : new Date(value);
}

function fallbackDateLabel(value: string | Date): string {
  return typeof value === "string" ? value : "";
}

/**
 * Formats a date in UTC using the native Intl.DateTimeFormat API.
 * Always uses UTC so server and client render the same calendar day.
 * @param value - ISO 8601 date string or Date
 * @returns Formatted date string (e.g., "Oct 2, 2025")
 */
export function formatDate(value: string | Date): string {
  try {
    const d = toDate(value);
    if (Number.isNaN(d.getTime())) return fallbackDateLabel(value);

    // Use Intl.DateTimeFormat for native, zero-bundle formatting
    // Output: "Oct 2, 2025"
    return new Intl.DateTimeFormat("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      timeZone: "UTC",
    }).format(d);
  } catch {
    return fallbackDateLabel(value);
  }
}

/**
 * Formats a date in UTC with the month spelled out, e.g. "October 2, 2025".
 *
 * The long form used in notification emails. It goes through `Intl` in UTC for
 * the same reason {@link formatDate} does: date-fns `format` renders in the
 * runtime's local timezone, so an expiry just after midnight UTC would be
 * announced as the previous day in an email while the dashboard showed the
 * correct one.
 *
 * @param value - ISO 8601 date string or Date
 * @returns Formatted date string (e.g., "October 2, 2025")
 */
export function formatDateLong(value: string | Date): string {
  try {
    const d = toDate(value);
    if (Number.isNaN(d.getTime())) return fallbackDateLabel(value);

    return new Intl.DateTimeFormat("en-US", {
      month: "long",
      day: "numeric",
      year: "numeric",
      timeZone: "UTC",
    }).format(d);
  } catch {
    return fallbackDateLabel(value);
  }
}

/**
 * Formats a date as ISO-like datetime in UTC using native Intl.DateTimeFormat API.
 * @param value - ISO 8601 date string or Date
 * @returns Formatted datetime string (e.g., "2025-10-02 14:30:05 UTC")
 */
export function formatDateTimeUtc(value: string | Date): string {
  try {
    const d = toDate(value);
    if (Number.isNaN(d.getTime())) return fallbackDateLabel(value);

    // Use Intl.DateTimeFormat with formatToParts for precise control
    const formatter = new Intl.DateTimeFormat("en-US", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      hour12: false,
      minute: "2-digit",
      second: "2-digit",
      timeZone: "UTC",
    });

    const parts = formatter.formatToParts(d);
    const partMap = Object.fromEntries(parts.map((p) => [p.type, p.value])) as Record<
      string,
      string
    >;

    // Construct: 2025-10-02 14:30:05 UTC
    return `${partMap.year}-${partMap.month}-${partMap.day} ${partMap.hour}:${partMap.minute}:${partMap.second} UTC`;
  } catch {
    return fallbackDateLabel(value);
  }
}

/**
 * Machine-readable instant for a `<time dateTime>` attribute.
 * @returns UTC ISO 8601 string, or `undefined` when `value` is not a valid date
 */
export function toDateTimeAttr(value: string | Date | number): string | undefined {
  try {
    const d = toDate(value);
    if (Number.isNaN(d.getTime())) return undefined;
    return d.toISOString();
  } catch {
    return undefined;
  }
}

/**
 * Machine-readable duration for a `<time dateTime>` attribute.
 * @param seconds - Non-negative duration in seconds
 * @returns ISO 8601 duration such as `PT3600S`, or `undefined` when invalid
 */
export function toDurationAttr(seconds: number): string | undefined {
  if (!Number.isFinite(seconds) || seconds < 0) return undefined;
  return `PT${seconds}S`;
}

/**
 * Relative timestamps, e.g. "in 5 days" or "3 months ago".
 *
 * Built on `Intl.RelativeTimeFormat` so the wording comes from the platform's
 * own locale data rather than a bundled table. This replaced date-fns
 * `formatDistanceStrict` and reproduces its output exactly; the two details
 * that make it exact are called out at their branches below.
 *
 * `Temporal` is deliberately not used here. It has no relative formatting of
 * its own, so it would not replace this, and Safari has not shipped it.
 */
/** Cached: constructing an Intl formatter is far more costly than using one. */
const relativeFormatter = new Intl.RelativeTimeFormat("en", { numeric: "always" });

const MS_PER_MINUTE = 60_000;
const MINUTES_IN_HOUR = 60;
const MINUTES_IN_DAY = 1_440;
const MINUTES_IN_MONTH = 43_200; // 30 days
const MINUTES_IN_YEAR = 525_600; // 365 days

/**
 * The offset between a date's wall-clock reading and the same reading in UTC.
 * Used to cancel out a DST shift so a span is counted in calendar terms.
 */
function timezoneOffsetMs(date: Date): number {
  const asUtc = new Date(
    Date.UTC(
      date.getFullYear(),
      date.getMonth(),
      date.getDate(),
      date.getHours(),
      date.getMinutes(),
      date.getSeconds(),
      date.getMilliseconds(),
    ),
  );
  // Years 0-99 would otherwise be read as 19xx.
  asUtc.setUTCFullYear(date.getFullYear());
  return date.getTime() - asUtc.getTime();
}

/**
 * Formats the distance between two instants as a single unit with a suffix.
 *
 * @param value - The instant being described
 * @param now - The instant to describe it relative to
 * @returns Relative label, or undefined when either date is invalid
 */
export function formatRelativeTime(value: string | Date | number, now: Date): string | undefined {
  const target = toDate(value);
  const elapsedMs = target.getTime() - now.getTime();
  if (Number.isNaN(elapsedMs)) return undefined;

  const minutes = elapsedMs / MS_PER_MINUTE;

  // Days and above are counted on the wall clock, so a span crossing a clock
  // change is not one hour longer or shorter than the calendar says.
  const calendarMinutes =
    (elapsedMs - (timezoneOffsetMs(target) - timezoneOffsetMs(now))) / MS_PER_MINUTE;

  const absMinutes = Math.abs(minutes);
  const absCalendarMinutes = Math.abs(calendarMinutes);

  // Round the magnitude and reapply the direction. Rounding the signed value
  // instead would turn -48.5 minutes into "48 minutes ago", because
  // Math.round breaks a tie upward and -48 is the larger number.
  const direction = elapsedMs < 0 ? -1 : 1;
  const round = (amount: number) => direction * Math.round(Math.abs(amount)) || 0;

  if (absMinutes < 1) {
    // An identical instant reads as just past rather than just future.
    const seconds = round(elapsedMs / 1_000);
    return relativeFormatter.format(seconds === 0 && elapsedMs <= 0 ? -0 : seconds, "second");
  }

  if (absMinutes < MINUTES_IN_HOUR) {
    return relativeFormatter.format(round(minutes), "minute");
  }

  if (absMinutes < MINUTES_IN_DAY) {
    return relativeFormatter.format(round(minutes / MINUTES_IN_HOUR), "hour");
  }

  if (absCalendarMinutes < MINUTES_IN_MONTH) {
    return relativeFormatter.format(round(calendarMinutes / MINUTES_IN_DAY), "day");
  }

  if (absCalendarMinutes < MINUTES_IN_YEAR) {
    const months = round(calendarMinutes / MINUTES_IN_MONTH);
    // Rounding up to a full twelve reads better as a year.
    return Math.abs(months) === 12
      ? relativeFormatter.format(Math.sign(months), "year")
      : relativeFormatter.format(months, "month");
  }

  return relativeFormatter.format(round(calendarMinutes / MINUTES_IN_YEAR), "year");
}

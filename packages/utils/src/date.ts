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

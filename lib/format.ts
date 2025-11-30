/**
 * Formats a date string in UTC using the native Intl.DateTimeFormat API.
 * @param iso - ISO 8601 date string or any valid date string
 * @returns Formatted date string (e.g., "Oct 2, 2025")
 */
export function formatDate(iso: string): string {
  try {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return iso;

    // Use Intl.DateTimeFormat for native, zero-bundle formatting
    // Output: "Oct 2, 2025"
    return new Intl.DateTimeFormat("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      timeZone: "UTC",
    }).format(d);
  } catch {
    return iso;
  }
}

/**
 * Formats a date string as ISO-like datetime in UTC using native Intl.DateTimeFormat API.
 * @param iso - ISO 8601 date string or any valid date string
 * @returns Formatted datetime string (e.g., "2025-10-02 14:30:05 UTC")
 */
export function formatDateTimeUtc(iso: string): string {
  try {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return iso;

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
    const partMap = Object.fromEntries(
      parts.map((p) => [p.type, p.value]),
    ) as Record<string, string>;

    // Construct: 2025-10-02 14:30:05 UTC
    return `${partMap.year}-${partMap.month}-${partMap.day} ${partMap.hour}:${partMap.minute}:${partMap.second} UTC`;
  } catch {
    return iso;
  }
}

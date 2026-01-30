/**
 * Formatting utilities for domain report data.
 */

/**
 * Format a date string for display.
 */
export function formatDate(dateString: string | undefined): string {
  if (!dateString) return "Unknown";

  try {
    const date = new Date(dateString);
    if (Number.isNaN(date.getTime())) return dateString;

    return new Intl.DateTimeFormat("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    }).format(date);
  } catch {
    return dateString;
  }
}

/**
 * Format a date with time for detailed display.
 */
export function formatDateTime(dateString: string | undefined): string {
  if (!dateString) return "Unknown";

  try {
    const date = new Date(dateString);
    if (Number.isNaN(date.getTime())) return dateString;

    return new Intl.DateTimeFormat("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      timeZoneName: "short",
    }).format(date);
  } catch {
    return dateString;
  }
}

/**
 * Calculate days until expiration.
 */
export function daysUntilExpiration(
  expirationDate: string | undefined,
): number | null {
  if (!expirationDate) return null;

  try {
    const expDate = new Date(expirationDate);
    if (Number.isNaN(expDate.getTime())) return null;

    const now = new Date();
    const diffTime = expDate.getTime() - now.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays;
  } catch {
    return null;
  }
}

/**
 * Format expiration status for display.
 */
export function formatExpirationStatus(
  expirationDate: string | undefined,
): string {
  const days = daysUntilExpiration(expirationDate);
  if (days === null) return "";

  if (days < 0) {
    return `Expired ${Math.abs(days)} days ago`;
  }
  if (days === 0) {
    return "Expires today";
  }
  if (days === 1) {
    return "Expires tomorrow";
  }
  if (days <= 30) {
    return `Expires in ${days} days`;
  }
  if (days <= 90) {
    return `Expires in ${Math.round(days / 7)} weeks`;
  }
  return "";
}

/**
 * Format TTL value to human-readable string.
 */
export function formatTtl(ttl: number | undefined): string {
  if (ttl === undefined || ttl === null) return "N/A";

  if (ttl < 60) {
    return `${ttl}s`;
  }
  if (ttl < 3600) {
    const minutes = Math.round(ttl / 60);
    return `${minutes}m`;
  }
  if (ttl < 86400) {
    const hours = Math.round(ttl / 3600);
    return `${hours}h`;
  }
  const days = Math.round(ttl / 86400);
  return `${days}d`;
}

/**
 * Truncate long strings with ellipsis.
 */
export function truncate(str: string, maxLength: number): string {
  if (str.length <= maxLength) return str;
  return `${str.slice(0, maxLength - 1)}...`;
}

/**
 * Format provider name for display.
 */
export function formatProvider(
  provider: { name: string | null } | null | undefined,
): string {
  return provider?.name ?? "Unknown";
}

/**
 * Format geo location for display.
 */
export function formatGeo(
  geo: { city: string; region: string; country: string } | null | undefined,
): string {
  if (!geo) return "Unknown";

  const parts = [geo.city, geo.region, geo.country].filter(Boolean);
  return parts.length > 0 ? parts.join(", ") : "Unknown";
}

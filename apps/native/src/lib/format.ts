import { i18n } from "@domainstack/i18n";

const DATE_FORMATTER_CACHE = new Map<string, Intl.DateTimeFormat>();

// Read the locale active in Lingui so an in-app language override (not just
// the device locale) takes effect. Falls back to the device locale when no
// catalog has been activated yet.
function dateFormatter(): Intl.DateTimeFormat {
  const locale = i18n.locale || "";
  let formatter = DATE_FORMATTER_CACHE.get(locale);
  if (!formatter) {
    formatter = new Intl.DateTimeFormat(locale || undefined, {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
    DATE_FORMATTER_CACHE.set(locale, formatter);
  }
  return formatter;
}

export function formatDate(value: Date | string | null | undefined): string {
  if (!value) return "—";
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "—";

  return dateFormatter().format(date);
}

export function daysUntil(value: Date | string | null | undefined): number | null {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  const diff = date.getTime() - Date.now();
  return Math.floor(diff / 86_400_000);
}

const PLURAL_RULES = new Intl.PluralRules();

export function plural(count: number, one: string, other: string): string {
  return PLURAL_RULES.select(count) === "one" ? one : other;
}

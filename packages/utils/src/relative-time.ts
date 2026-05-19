import { differenceInDays } from "date-fns";

export type RelativeExpiryTone = "danger" | "warn" | "default";

export interface RelativeExpiryInfo {
  text: string;
  daysUntil: number;
  tone: RelativeExpiryTone;
}

export interface RelativeExpiryOptions {
  now?: Date;
  dangerDays?: number;
  warnDays?: number;
  /**
   * BCP 47 locale for the relative phrase. Omit to use the runtime default
   * (preserves prior English-only behavior for callers that don't localize,
   * e.g. the web report). Native callers pass the active app locale.
   */
  locale?: string;
}

// Cache one formatter per locale — constructing `Intl.RelativeTimeFormat`
// is comparatively expensive and these run in list rows.
const RTF_CACHE = new Map<string, Intl.RelativeTimeFormat>();

function getFormatter(locale?: string): Intl.RelativeTimeFormat {
  const key = locale ?? "";
  let formatter = RTF_CACHE.get(key);
  if (!formatter) {
    // `numeric: "always"` keeps phrasing close to the previous strict
    // date-fns output ("2 days ago" rather than "yesterday").
    formatter = new Intl.RelativeTimeFormat(locale, { numeric: "always" });
    RTF_CACHE.set(key, formatter);
  }
  return formatter;
}

// Largest-sensible-unit selection (strict): walk up the cascade until the
// remaining magnitude fits the next unit, mirroring `formatDistanceToNowStrict`.
const CASCADE: Array<[Intl.RelativeTimeFormatUnit, number]> = [
  ["second", 60],
  ["minute", 60],
  ["hour", 24],
  ["day", 7],
  ["week", 4.34524],
  ["month", 12],
  ["year", Number.POSITIVE_INFINITY],
];

function formatRelative(target: Date, now: Date, locale?: string): string {
  const rtf = getFormatter(locale);
  let delta = (target.getTime() - now.getTime()) / 1000; // signed seconds
  for (const [unit, amount] of CASCADE) {
    if (Math.abs(delta) < amount) {
      return rtf.format(Math.round(delta), unit);
    }
    delta /= amount;
  }
  return rtf.format(Math.round(delta), "year");
}

export function formatRelativeTime(value: Date | string | number, locale?: string): string | null {
  try {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return null;
    return formatRelative(date, new Date(), locale);
  } catch {
    return null;
  }
}

export function getRelativeExpiry(
  target: Date | string | number,
  options: RelativeExpiryOptions = {},
): RelativeExpiryInfo | null {
  const { now = new Date(), dangerDays = 7, warnDays = 14, locale } = options;
  try {
    const targetDate = new Date(target);
    if (Number.isNaN(targetDate.getTime())) return null;
    const text = formatRelative(targetDate, now, locale);
    const daysUntil = differenceInDays(targetDate, now);
    let tone: RelativeExpiryTone = "default";
    if (daysUntil <= dangerDays) tone = "danger";
    else if (daysUntil <= warnDays) tone = "warn";
    return { text, daysUntil, tone };
  } catch {
    return null;
  }
}

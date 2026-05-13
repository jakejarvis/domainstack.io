import { differenceInDays, formatDistanceToNowStrict } from "date-fns";

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
}

export function formatRelativeTime(value: Date | string | number): string | null {
  try {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return null;
    return formatDistanceToNowStrict(date, { addSuffix: true });
  } catch {
    return null;
  }
}

export function getRelativeExpiry(
  target: Date | string | number,
  options: RelativeExpiryOptions = {},
): RelativeExpiryInfo | null {
  const { now = new Date(), dangerDays = 7, warnDays = 14 } = options;
  try {
    const targetDate = new Date(target);
    if (Number.isNaN(targetDate.getTime())) return null;
    const text = formatDistanceToNowStrict(targetDate, { addSuffix: true });
    const daysUntil = differenceInDays(targetDate, now);
    let tone: RelativeExpiryTone = "default";
    if (daysUntil <= dangerDays) tone = "danger";
    else if (daysUntil <= warnDays) tone = "warn";
    return { text, daysUntil, tone };
  } catch {
    return null;
  }
}

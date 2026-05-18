const DATE_FORMATTER = new Intl.DateTimeFormat(undefined, {
  day: "numeric",
  month: "short",
  year: "numeric",
});

export function formatDate(value: Date | string | null | undefined): string {
  if (!value) return "—";
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "—";

  return DATE_FORMATTER.format(date);
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

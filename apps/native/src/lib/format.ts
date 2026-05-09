export function formatDate(value: Date | string | null | undefined): string {
  if (!value) return "Unknown";
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "Unknown";

  return new Intl.DateTimeFormat(undefined, {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(date);
}

export function formatCount(value: number): string {
  return new Intl.NumberFormat(undefined).format(value);
}

export function daysUntil(value: Date | string | null | undefined): number | null {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  const diff = date.getTime() - Date.now();
  return Math.ceil(diff / 86_400_000);
}

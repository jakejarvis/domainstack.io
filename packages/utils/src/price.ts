const FORMATTER_CACHE = new Map<string, Intl.NumberFormat>();

function getFormatter(locale: string, currency: string): Intl.NumberFormat {
  const key = `${locale}|${currency}`;
  let formatter = FORMATTER_CACHE.get(key);
  if (!formatter) {
    formatter = new Intl.NumberFormat(locale, {
      style: "currency",
      currency,
      maximumFractionDigits: 2,
    });
    FORMATTER_CACHE.set(key, formatter);
  }
  return formatter;
}

export interface FormatPriceOptions {
  /** BCP 47 locale tag. Defaults to `en-US` to preserve existing output. */
  locale?: string;
  /** ISO 4217 currency code. Defaults to `USD`. */
  currency?: string;
}

/**
 * Format a numeric price string as currency; returns null if the input isn't a
 * finite number. Defaults (`en-US` / `USD`) keep existing callers byte-identical;
 * pass options to localize.
 */
export function formatPrice(value: string, opts?: FormatPriceOptions): string | null {
  const amount = Number.parseFloat(value);
  if (!Number.isFinite(amount)) return null;

  const locale = opts?.locale ?? "en-US";
  const currency = opts?.currency ?? "USD";
  try {
    return getFormatter(locale, currency).format(amount);
  } catch {
    return `$${amount.toFixed(2)}`;
  }
}

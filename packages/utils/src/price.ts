const USD = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 2,
});

/** Format a numeric price string as USD; returns null if the input isn't a finite number. */
export function formatPrice(value: string): string | null {
  const amount = Number.parseFloat(value);
  if (!Number.isFinite(amount)) return null;
  try {
    return USD.format(amount);
  } catch {
    return `$${amount.toFixed(2)}`;
  }
}

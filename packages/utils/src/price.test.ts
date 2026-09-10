import { describe, expect, it } from "vitest";

import { formatPrice } from "./price";

describe("formatPrice", () => {
  it("defaults to en-US / USD (unchanged for existing callers)", () => {
    expect(formatPrice("9.99")).toBe("$9.99");
    expect(formatPrice("1234.5")).toBe("$1,234.50");
  });

  it("returns null for non-finite input", () => {
    expect(formatPrice("not-a-number")).toBeNull();
    expect(formatPrice("")).toBeNull();
  });

  it("honors an explicit locale + currency", () => {
    const eur = formatPrice("1234.56", { locale: "de-DE", currency: "EUR" });
    expect(eur).toContain("€");
    expect(eur).not.toContain("$");
  });
});

describe("formatPrice fallback", () => {
  it("does not imply USD when the currency code is unsupported", () => {
    const result = formatPrice("9.99", { currency: "NOT_A_CURRENCY" });
    expect(result).toBe("9.99 NOT_A_CURRENCY");
    expect(result).not.toContain("$");
  });
});

import { describe, expect, it } from "vitest";

import { DEFAULT_LOCALE, isLocale, negotiateLocale } from "./config";

describe("isLocale", () => {
  it("accepts supported locales", () => {
    expect(isLocale("en")).toBe(true);
    expect(isLocale("de")).toBe(true);
  });

  it("rejects unsupported / empty values", () => {
    expect(isLocale("xx")).toBe(false);
    expect(isLocale("")).toBe(false);
    expect(isLocale(null)).toBe(false);
    expect(isLocale(undefined)).toBe(false);
  });
});

describe("negotiateLocale", () => {
  it("falls back to the default locale when header is missing", () => {
    expect(negotiateLocale(null)).toBe(DEFAULT_LOCALE);
    expect(negotiateLocale("")).toBe(DEFAULT_LOCALE);
  });

  it("picks the first supported language tag", () => {
    expect(negotiateLocale("fr-FR,fr;q=0.9,en;q=0.8")).toBe("fr");
    expect(negotiateLocale("es-ES,es;q=0.9")).toBe("es");
  });

  it("skips unsupported tags and falls through", () => {
    expect(negotiateLocale("zh-CN,ja;q=0.9,de;q=0.8")).toBe("de");
    expect(negotiateLocale("zh-CN,ja;q=0.9")).toBe(DEFAULT_LOCALE);
  });
});

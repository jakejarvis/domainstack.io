import { describe, expect, it } from "vitest";

import { formatDate, formatDateTimeUtc } from "./date";

const ISO = "2025-10-02T14:30:05Z";

describe("formatDate", () => {
  it("defaults to en-US (unchanged for existing callers)", () => {
    expect(formatDate(ISO)).toBe("Oct 2, 2025");
  });

  it("localizes when a locale is passed", () => {
    expect(formatDate(ISO, "fr-FR")).not.toBe(formatDate(ISO));
  });

  it("returns the raw input for invalid dates", () => {
    expect(formatDate("nope")).toBe("nope");
  });
});

describe("formatDateTimeUtc", () => {
  it("produces a locale-stable UTC string by default", () => {
    expect(formatDateTimeUtc(ISO)).toBe("2025-10-02 14:30:05 UTC");
  });

  it("keeps the same shape with a different locale", () => {
    expect(formatDateTimeUtc(ISO, "de-DE")).toBe("2025-10-02 14:30:05 UTC");
  });
});

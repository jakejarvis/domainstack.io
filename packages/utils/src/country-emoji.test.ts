import { describe, expect, it } from "vitest";

import { countryCodeToEmoji } from "./country-emoji";

describe("countryCodeToEmoji", () => {
  it("converts US to flag emoji", () => {
    expect(countryCodeToEmoji("US")).toBe("🇺🇸");
  });

  it("converts DE to flag emoji", () => {
    expect(countryCodeToEmoji("DE")).toBe("🇩🇪");
  });

  it("converts JP to flag emoji", () => {
    expect(countryCodeToEmoji("JP")).toBe("🇯🇵");
  });

  it("handles lowercase country codes", () => {
    expect(countryCodeToEmoji("gb")).toBe("🇬🇧");
  });

  it("returns empty string for empty input", () => {
    expect(countryCodeToEmoji("")).toBe("");
  });

  it("returns empty string for single character", () => {
    expect(countryCodeToEmoji("U")).toBe("");
  });

  it("returns empty string for three characters", () => {
    expect(countryCodeToEmoji("USA")).toBe("");
  });

  it("returns empty string for invalid characters", () => {
    expect(countryCodeToEmoji("12")).toBe("");
    expect(countryCodeToEmoji("!@")).toBe("");
  });
});

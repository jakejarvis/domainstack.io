/* @vitest-environment node */
import type * as tls from "node:tls";
import { describe, expect, it } from "vitest";
import { parseAltNames, toName } from "@/lib/tls-utils";

describe("certificates helper functions", () => {
  describe("toName", () => {
    it("prefers CN over O", () => {
      expect(toName({ CN: "example.com" } as tls.Certificate)).toBe(
        "example.com",
      );
    });

    it("falls back to O when CN is not present", () => {
      expect(toName({ O: "Organization" } as tls.Certificate)).toBe(
        "Organization",
      );
    });

    it("stringifies unknown certificate formats", () => {
      expect(toName({ X: "Unknown" } as unknown as tls.Certificate)).toContain(
        "X",
      );
    });

    it("returns empty string for undefined", () => {
      expect(toName(undefined)).toBe("");
    });
  });

  describe("parseAltNames", () => {
    it("extracts DNS and IP Address values", () => {
      expect(
        parseAltNames(
          "DNS:example.com, DNS:www.example.com, IP Address:1.2.3.4",
        ),
      ).toEqual(["example.com", "www.example.com", "1.2.3.4"]);
    });

    it("filters out non-DNS/IP values", () => {
      expect(parseAltNames("URI:http://example.com")).toEqual([]);
    });

    it("handles undefined input", () => {
      expect(parseAltNames(undefined)).toEqual([]);
    });

    it("handles empty string input", () => {
      expect(parseAltNames("")).toEqual([]);
    });

    it("handles mixed case kind prefixes", () => {
      expect(parseAltNames("dns:lower.com, DNS:upper.com")).toEqual([
        "lower.com",
        "upper.com",
      ]);
    });
  });
});

/* @vitest-environment node */
import type * as tls from "node:tls";
import { describe, expect, it } from "vitest";
import { parseAltNames, toName } from "@/lib/tls-utils";

describe("tls-utils", () => {
  describe("toName", () => {
    it("prefers CN over O", () => {
      expect(toName({ CN: "test.invalid" } as tls.Certificate)).toBe(
        "test.invalid",
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
          "DNS:test.invalid, DNS:www.test.invalid, IP Address:1.2.3.4",
        ),
      ).toEqual(["test.invalid", "www.test.invalid", "1.2.3.4"]);
    });

    it("filters out non-DNS/IP values", () => {
      expect(parseAltNames("URI:http://test.invalid")).toEqual([]);
    });

    it("handles undefined input", () => {
      expect(parseAltNames(undefined)).toEqual([]);
    });

    it("handles empty string input", () => {
      expect(parseAltNames("")).toEqual([]);
    });

    it("handles mixed case kind prefixes", () => {
      expect(parseAltNames("dns:lower.invalid, DNS:upper.invalid")).toEqual([
        "lower.invalid",
        "upper.invalid",
      ]);
    });
  });
});

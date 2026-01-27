/* @vitest-environment node */
import { describe, expect, it } from "vitest";
import { providerOrderForLookup } from "@/lib/dns-utils";

describe("lib/dns-utils", () => {
  describe("providerOrderForLookup", () => {
    it("returns all providers", () => {
      const result = providerOrderForLookup("example.test");
      expect(result.length).toBeGreaterThan(0);
    });

    it("is deterministic for same domain", () => {
      const domain = "example.test";
      const result1 = providerOrderForLookup(domain);
      const result2 = providerOrderForLookup(domain);
      expect(result1).toEqual(result2);
    });

    it("is case-insensitive (RFC 1035)", () => {
      const lower = providerOrderForLookup("example.test");
      const upper = providerOrderForLookup("EXAMPLE.TEST");
      const mixed = providerOrderForLookup("Example.Test");

      expect(lower).toEqual(upper);
      expect(lower).toEqual(mixed);
    });

    it("produces different orders for different domains", () => {
      const order1 = providerOrderForLookup("example.test");
      const order2 = providerOrderForLookup("google.test");

      // Different domains should likely produce different orders
      // (not guaranteed, but statistically likely with good hash function)
      const sameOrder =
        order1.every((p, i) => p.key === order2[i]?.key) &&
        order1.length === order2.length;

      // This test may occasionally fail with a poor hash or collision,
      // but simpleHash should distribute well enough for common domains
      expect(sameOrder).toBe(false);
    });
  });
});

/* @vitest-environment node */
import { describe, expect, it } from "vitest";
import { DOH_PROVIDERS, providerOrderForLookup } from "@/lib/dns-utils";

describe("lib/dns-utils", () => {
  describe("providerOrderForLookup", () => {
    it("returns all providers", () => {
      const result = providerOrderForLookup("example.com");
      expect(result).toHaveLength(DOH_PROVIDERS.length);
    });

    it("is deterministic for same domain", () => {
      const domain = "example.com";
      const result1 = providerOrderForLookup(domain);
      const result2 = providerOrderForLookup(domain);
      expect(result1).toEqual(result2);
    });

    it("is case-insensitive (RFC 1035)", () => {
      const lower = providerOrderForLookup("example.com");
      const upper = providerOrderForLookup("EXAMPLE.COM");
      const mixed = providerOrderForLookup("Example.Com");

      expect(lower).toEqual(upper);
      expect(lower).toEqual(mixed);
    });

    it("produces different orders for different domains", () => {
      const order1 = providerOrderForLookup("example.com");
      const order2 = providerOrderForLookup("google.com");

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

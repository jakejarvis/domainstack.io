import { describe, expect, it } from "vitest";
import { simpleHash } from "./simple-hash";

describe("simpleHash", () => {
  it("is deterministic and matches expected values", () => {
    expect(simpleHash("")).toBe(0);
    expect(simpleHash("example.com")).toBe(1_944_013_059);
    expect(simpleHash("domain.com")).toBe(1_245_037_225);
    expect(simpleHash("abc")).toBe(96_354);
  });

  it("returns non-negative integers", () => {
    // Test various inputs to ensure we always get positive numbers
    const inputs = [
      "test",
      "hello world",
      "a".repeat(100),
      "\u0000\u0001\u0002",
    ];
    for (const input of inputs) {
      const result = simpleHash(input);
      expect(result).toBeGreaterThanOrEqual(0);
      expect(Number.isInteger(result)).toBe(true);
    }
  });
});

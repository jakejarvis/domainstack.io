/* @vitest-environment node */
import { describe, expect, it } from "vitest";
import { simpleHash } from "@/lib/simple-hash";

describe("lib/simple-hash", () => {
  it("simpleHash is deterministic and matches expected values", () => {
    expect(simpleHash("")).toBe(0);
    expect(simpleHash("example.com")).toBe(1944013059);
    expect(simpleHash("domain.com")).toBe(1245037225);
    expect(simpleHash("abc")).toBe(96354);
  });
});

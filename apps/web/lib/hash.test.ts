/* @vitest-environment node */
import { describe, expect, it } from "vitest";
import { deterministicHash } from "@/lib/hash";

describe("lib/hash", () => {
  it("deterministicHash is deterministic (default length 32) and matches expected value", () => {
    expect(deterministicHash("favicon:example.com", "secret")).toBe(
      "46a029ccb58a7e2d7064e1be6debaa11",
    );
  });

  it("deterministicHash clamps length to 0..64", () => {
    // Existing behavior we want to preserve: length 0 returns empty string
    expect(deterministicHash("favicon:example.com", "secret", 0)).toBe("");

    // A negative length previously produced "all but last char" via slice(0, -1).
    // We intentionally clamp to 0 to keep this parameter predictable.
    expect(deterministicHash("favicon:example.com", "secret", -1)).toBe("");

    // >64 should clamp to full digest length
    expect(deterministicHash("favicon:example.com", "secret", 999)).toBe(
      "46a029ccb58a7e2d7064e1be6debaa11a0ab53b49e0924c14c3a1f914ff3ef71",
    );
  });
});

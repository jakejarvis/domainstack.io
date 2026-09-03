import { describe, expect, it } from "vitest";

import { resolveClientIp } from "./context";

describe("resolveClientIp", () => {
  it("reads the first x-forwarded-for hop when there is no Request", () => {
    const headers = new Headers({
      "x-forwarded-for": "203.0.113.10, 10.0.0.1",
    });

    expect(resolveClientIp(undefined, headers)).toBe("203.0.113.10");
  });

  it("falls back to x-real-ip then x-vercel-forwarded-for", () => {
    expect(resolveClientIp(undefined, new Headers({ "x-real-ip": "198.51.100.2" }))).toBe(
      "198.51.100.2",
    );
    expect(resolveClientIp(undefined, new Headers({ "x-vercel-forwarded-for": "192.0.2.9" }))).toBe(
      "192.0.2.9",
    );
  });

  it("returns null when neither a Request nor forwarding headers are present", () => {
    expect(resolveClientIp()).toBeNull();
    expect(resolveClientIp(undefined, new Headers())).toBeNull();
  });
});

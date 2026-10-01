import { describe, expect, it } from "vitest";

import { rateLimitBucket } from "@domainstack/redis/enforce";

describe("rateLimitBucket", () => {
  it("leaves IPv4 addresses unchanged", () => {
    expect(rateLimitBucket("203.0.113.7")).toBe("203.0.113.7");
  });

  it("buckets IPv6 addresses by their /64", () => {
    expect(rateLimitBucket("2001:db8:1:2:3:4:5:6")).toBe("2001:db8:1:2::/64");
    expect(rateLimitBucket("2001:db8:1:2:ffff::1")).toBe("2001:db8:1:2::/64");
  });

  it("collapses IPv4-mapped IPv6 to plain IPv4", () => {
    expect(rateLimitBucket("::ffff:203.0.113.7")).toBe("203.0.113.7");
  });

  it("leaves non-IP identifiers unchanged", () => {
    expect(rateLimitBucket("a1B2c3D4e5F6g7H8i9J0k1L2m3N4o5P6")).toBe(
      "a1B2c3D4e5F6g7H8i9J0k1L2m3N4o5P6",
    );
    expect(rateLimitBucket("12345")).toBe("12345");
    expect(rateLimitBucket("0123456789abcdef".repeat(4))).toBe("0123456789abcdef".repeat(4));
  });
});

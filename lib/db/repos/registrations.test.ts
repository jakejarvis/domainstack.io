/* @vitest-environment node */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Hoist mock functions before vi.mock calls
const mockSetex = vi.hoisted(() => vi.fn());

// Mock the DB client to prevent DATABASE_URL requirement
vi.mock("@/lib/db/client", () => ({
  db: {},
}));

// Mock Redis with a spy for setex
vi.mock("@/lib/redis", () => ({
  redis: {
    setex: mockSetex,
  },
  ns: (...parts: string[]) => parts.join(":"),
}));

import {
  getRegistrationCacheKey,
  setRegistrationStatusInCache,
} from "./registrations";

describe("getRegistrationCacheKey", () => {
  it("normalizes domain to lowercase", () => {
    expect(getRegistrationCacheKey("EXAMPLE.COM")).toBe(
      getRegistrationCacheKey("example.com"),
    );
  });

  it("removes trailing dots", () => {
    expect(getRegistrationCacheKey("example.com.")).toBe(
      getRegistrationCacheKey("example.com"),
    );
    expect(getRegistrationCacheKey("example.com...")).toBe(
      getRegistrationCacheKey("example.com"),
    );
  });

  it("trims whitespace", () => {
    expect(getRegistrationCacheKey(" example.com ")).toBe(
      getRegistrationCacheKey("example.com"),
    );
    expect(getRegistrationCacheKey("  example.com  ")).toBe(
      getRegistrationCacheKey("example.com"),
    );
  });

  it("combines all normalization steps", () => {
    expect(getRegistrationCacheKey(" EXAMPLE.COM. ")).toBe(
      getRegistrationCacheKey("example.com"),
    );
    expect(getRegistrationCacheKey("  EXAMPLE.COM...  ")).toBe(
      getRegistrationCacheKey("example.com"),
    );
  });

  it("handles empty and undefined safely", () => {
    expect(getRegistrationCacheKey("")).toContain("reg:");
    expect(getRegistrationCacheKey(undefined as unknown as string)).toContain(
      "reg:",
    );
  });

  it("preserves internal dots and structure", () => {
    const key1 = getRegistrationCacheKey("sub.example.com");
    const key2 = getRegistrationCacheKey("sub.example.com.");
    expect(key1).toBe(key2);
    expect(key1).toContain("sub.example.com");
  });
});

describe("setRegistrationStatusInCache", () => {
  beforeEach(() => {
    mockSetex.mockClear();
  });

  afterEach(() => {
    // Console spies cleaned up automatically by vi.restoreAllMocks()
    vi.restoreAllMocks();
  });

  it("calls redis.setex with valid TTL", async () => {
    await setRegistrationStatusInCache("example.com", true, 3600);
    expect(mockSetex).toHaveBeenCalledOnce();
    expect(mockSetex).toHaveBeenCalledWith("reg:example.com", 3600, "1");
  });

  it("skips redis.setex when TTL is zero", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    await setRegistrationStatusInCache("example.com", true, 0);
    expect(mockSetex).not.toHaveBeenCalled();
    expect(console.warn).toHaveBeenCalledWith(
      "[redis] setRegistrationStatusInCache skipped for example.com: invalid TTL 0",
    );
  });

  it("skips redis.setex when TTL is negative", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    await setRegistrationStatusInCache("example.com", true, -100);
    expect(mockSetex).not.toHaveBeenCalled();
    expect(console.warn).toHaveBeenCalledWith(
      "[redis] setRegistrationStatusInCache skipped for example.com: invalid TTL -100",
    );
  });

  it("skips redis.setex when TTL is NaN", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    await setRegistrationStatusInCache("example.com", true, Number.NaN);
    expect(mockSetex).not.toHaveBeenCalled();
    expect(console.warn).toHaveBeenCalledWith(
      "[redis] setRegistrationStatusInCache skipped for example.com: invalid TTL NaN",
    );
  });

  it("skips redis.setex when TTL is Infinity", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    await setRegistrationStatusInCache(
      "example.com",
      true,
      Number.POSITIVE_INFINITY,
    );
    expect(mockSetex).not.toHaveBeenCalled();
    expect(console.warn).toHaveBeenCalledWith(
      "[redis] setRegistrationStatusInCache skipped for example.com: invalid TTL Infinity",
    );
  });

  it("skips redis.setex when TTL is not an integer", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    await setRegistrationStatusInCache("example.com", true, 1.5);
    expect(mockSetex).not.toHaveBeenCalled();
    expect(console.warn).toHaveBeenCalledWith(
      "[redis] setRegistrationStatusInCache skipped for example.com: invalid TTL 1.5",
    );
  });

  it("uses '1' for registered domains", async () => {
    await setRegistrationStatusInCache("example.com", true, 3600);
    expect(mockSetex).toHaveBeenCalledWith("reg:example.com", 3600, "1");
  });

  it("uses '0' for unregistered domains", async () => {
    await setRegistrationStatusInCache("example.com", false, 1800);
    expect(mockSetex).toHaveBeenCalledWith("reg:example.com", 1800, "0");
  });
});

/* @vitest-environment node */
import { afterEach, describe, expect, it, vi } from "vitest";

// Mock @vercel/edge-config
const mockGet = vi.fn();
vi.mock("@vercel/edge-config", () => ({
  get: mockGet,
}));

// Mock environment variable
const originalEnv = process.env.EDGE_CONFIG;

afterEach(() => {
  mockGet.mockReset();
  process.env.EDGE_CONFIG = originalEnv;
});

describe("getDefaultSuggestions", () => {
  it("returns empty array when EDGE_CONFIG is not set", async () => {
    delete process.env.EDGE_CONFIG;

    // Re-import to pick up env changes
    const { getDefaultSuggestions } = await import("./edge-config");

    const result = await getDefaultSuggestions();
    expect(result).toEqual([]);
    expect(mockGet).not.toHaveBeenCalled();
  });

  it("returns suggestions from Edge Config", async () => {
    process.env.EDGE_CONFIG = "https://edge-config.vercel.com/test";
    mockGet.mockResolvedValueOnce(["github.com", "google.com"]);

    // Re-import to pick up env changes
    vi.resetModules();
    const { getDefaultSuggestions } = await import("./edge-config");

    const result = await getDefaultSuggestions();
    expect(result).toEqual(["github.com", "google.com"]);
    expect(mockGet).toHaveBeenCalledWith("domain_suggestions");
  });

  it("returns empty array when Edge Config value is null", async () => {
    process.env.EDGE_CONFIG = "https://edge-config.vercel.com/test";
    mockGet.mockResolvedValueOnce(null);

    vi.resetModules();
    const { getDefaultSuggestions } = await import("./edge-config");

    const result = await getDefaultSuggestions();
    expect(result).toEqual([]);
  });

  it("returns empty array on error", async () => {
    process.env.EDGE_CONFIG = "https://edge-config.vercel.com/test";
    mockGet.mockRejectedValueOnce(new Error("Connection failed"));

    vi.resetModules();
    const { getDefaultSuggestions } = await import("./edge-config");

    const result = await getDefaultSuggestions();
    expect(result).toEqual([]);
  });

  it("handles prerender error gracefully", async () => {
    process.env.EDGE_CONFIG = "https://edge-config.vercel.com/test";
    mockGet.mockRejectedValueOnce(
      new Error("During prerendering, dynamic 'use cache' rejects"),
    );

    vi.resetModules();
    const { getDefaultSuggestions } = await import("./edge-config");

    const result = await getDefaultSuggestions();
    expect(result).toEqual([]);
  });
});

describe("getTierLimits", () => {
  it("returns default limits when EDGE_CONFIG is not set", async () => {
    delete process.env.EDGE_CONFIG;

    vi.resetModules();
    const { getTierLimits } = await import("./edge-config");

    const result = await getTierLimits();
    expect(result).toEqual({ free: 5, pro: 50 });
    expect(mockGet).not.toHaveBeenCalled();
  });

  it("returns limits from Edge Config", async () => {
    process.env.EDGE_CONFIG = "https://edge-config.vercel.com/test";
    mockGet.mockResolvedValueOnce({ free: 10, pro: 100 });

    vi.resetModules();
    const { getTierLimits } = await import("./edge-config");

    const result = await getTierLimits();
    expect(result).toEqual({ free: 10, pro: 100 });
    expect(mockGet).toHaveBeenCalledWith("tier_limits");
  });

  it("merges partial Edge Config with defaults", async () => {
    process.env.EDGE_CONFIG = "https://edge-config.vercel.com/test";
    // Only free is set, pro should use default
    mockGet.mockResolvedValueOnce({ free: 20 });

    vi.resetModules();
    const { getTierLimits } = await import("./edge-config");

    const result = await getTierLimits();
    expect(result).toEqual({ free: 20, pro: 50 });
  });

  it("returns defaults when Edge Config value is null", async () => {
    process.env.EDGE_CONFIG = "https://edge-config.vercel.com/test";
    mockGet.mockResolvedValueOnce(null);

    vi.resetModules();
    const { getTierLimits } = await import("./edge-config");

    const result = await getTierLimits();
    expect(result).toEqual({ free: 5, pro: 50 });
  });

  it("returns defaults on error", async () => {
    process.env.EDGE_CONFIG = "https://edge-config.vercel.com/test";
    mockGet.mockRejectedValueOnce(new Error("Connection failed"));

    vi.resetModules();
    const { getTierLimits } = await import("./edge-config");

    const result = await getTierLimits();
    expect(result).toEqual({ free: 5, pro: 50 });
  });
});

describe("getMaxDomainsForTier", () => {
  it("returns free tier limit", async () => {
    process.env.EDGE_CONFIG = "https://edge-config.vercel.com/test";
    mockGet.mockResolvedValueOnce({ free: 7, pro: 70 });

    vi.resetModules();
    const { getMaxDomainsForTier } = await import("./edge-config");

    const result = await getMaxDomainsForTier("free");
    expect(result).toBe(7);
  });

  it("returns pro tier limit", async () => {
    process.env.EDGE_CONFIG = "https://edge-config.vercel.com/test";
    mockGet.mockResolvedValueOnce({ free: 7, pro: 70 });

    vi.resetModules();
    const { getMaxDomainsForTier } = await import("./edge-config");

    const result = await getMaxDomainsForTier("pro");
    expect(result).toBe(70);
  });

  it("returns default when Edge Config unavailable", async () => {
    delete process.env.EDGE_CONFIG;

    vi.resetModules();
    const { getMaxDomainsForTier } = await import("./edge-config");

    const freeLimit = await getMaxDomainsForTier("free");
    const proLimit = await getMaxDomainsForTier("pro");

    expect(freeLimit).toBe(5);
    expect(proLimit).toBe(50);
  });
});

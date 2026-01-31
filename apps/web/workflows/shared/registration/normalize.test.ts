/* @vitest-environment node */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Mock Edge Config
vi.mock("@/lib/edge-config", () => ({
  getProviderCatalog: vi.fn().mockResolvedValue(null),
}));

// Mock provider detection
vi.mock("@domainstack/core/providers", () => ({
  detectRegistrar: vi.fn().mockReturnValue(null),
  getProvidersFromCatalog: vi.fn().mockReturnValue([]),
}));

// Mock providers repo functions
vi.mock("@domainstack/db/queries", () => ({
  resolveOrCreateProviderId: vi.fn().mockResolvedValue(null),
  upsertCatalogProvider: vi.fn().mockResolvedValue({ id: "test-id" }),
}));

describe("normalizeAndBuildResponseStep", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("builds correct response for registered domain", async () => {
    const recordJson = JSON.stringify({
      domain: "registered.invalid",
      tld: "invalid",
      isRegistered: true,
      source: "rdap",
      registrar: { name: "Namecheap", url: "https://namecheap.com" },
      creationDate: "2020-01-01T00:00:00Z",
      expirationDate: "2025-01-01T00:00:00Z",
      nameservers: [{ host: "ns1.test.invalid" }],
    });

    const { normalizeAndBuildResponseStep } = await import("./normalize");
    const response = await normalizeAndBuildResponseStep(recordJson);

    expect(response.status).toBe("registered");
    expect(response.isRegistered).toBe(true);
    expect(response.creationDate).toBe("2020-01-01T00:00:00Z");
    expect(response.expirationDate).toBe("2025-01-01T00:00:00Z");
  });

  it("builds correct response for unregistered domain", async () => {
    const recordJson = JSON.stringify({
      domain: "available.invalid",
      tld: "invalid",
      isRegistered: false,
      source: "rdap",
    });

    const { normalizeAndBuildResponseStep } = await import("./normalize");
    const response = await normalizeAndBuildResponseStep(recordJson);

    expect(response.status).toBe("unregistered");
    expect(response.isRegistered).toBe(false);
  });
});

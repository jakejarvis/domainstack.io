/* @vitest-environment node */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Mock provider catalog
vi.mock("@/lib/providers/catalog", () => ({
  getProviders: vi.fn().mockResolvedValue([]),
}));

// Mock provider detection
vi.mock("@/lib/providers/detection", () => ({
  detectRegistrar: vi.fn().mockReturnValue(null),
}));

// Mock providers repo
vi.mock("@/lib/db/repos/providers", () => ({
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
      domain: "registered.com",
      tld: "com",
      isRegistered: true,
      source: "rdap",
      registrar: { name: "Namecheap", url: "https://namecheap.com" },
      creationDate: "2020-01-01T00:00:00Z",
      expirationDate: "2025-01-01T00:00:00Z",
      nameservers: [{ host: "ns1.example.com" }],
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
      domain: "available.com",
      tld: "com",
      isRegistered: false,
      source: "rdap",
    });

    const { normalizeAndBuildResponseStep } = await import("./normalize");
    const response = await normalizeAndBuildResponseStep(recordJson);

    expect(response.status).toBe("unregistered");
    expect(response.isRegistered).toBe(false);
  });
});

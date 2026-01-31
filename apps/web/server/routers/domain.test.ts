/* @vitest-environment node */
import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";

// Initialize PGlite before importing anything that uses the db
const { makePGliteDb, closePGliteDb } = await import("@domainstack/db/testing");
const { db } = await makePGliteDb();

// Mock workflow/api to avoid starting real workflows (still used by non-registration procedures)
vi.mock("workflow/api", () => ({
  start: vi.fn().mockResolvedValue({
    runId: "mock-run-id",
    returnValue: Promise.resolve({ success: true, data: {} }),
  }),
}));

// Mock the services (used by getRegistration and getDnsRecords)
vi.mock("@domainstack/server", async (importOriginal) => {
  const original = await importOriginal<typeof import("@domainstack/server")>();
  return {
    ...original,
    fetchRegistration: vi.fn().mockResolvedValue({
      success: true,
      data: {
        isRegistered: true,
        registrarProvider: {
          id: "00000000-0000-0000-0000-000000000002",
          name: "Unknown",
        },
      },
    }),
    fetchDns: vi.fn().mockResolvedValue({
      success: true,
      data: {
        records: [],
        resolver: "cloudflare",
      },
    }),
  };
});

// Mock edge-config
vi.mock("@domainstack/server/edge-config", () => ({
  getProviderCatalog: vi.fn().mockResolvedValue(null),
}));

// Mock next/headers to avoid errors outside request context
vi.mock("next/headers", () => ({
  headers: vi.fn().mockResolvedValue(new Map()),
}));

// Mock next/server after() to be a no-op
vi.mock("next/server", () => ({
  after: vi.fn((fn) => fn()),
}));

// Now import modules that depend on the db
const { dnsRecords, domains, providers, registrations } = await import(
  "@domainstack/db/schema"
);
const { start } = await import("workflow/api");
const { fetchDns, fetchRegistration } = await import("@domainstack/server");
const { createCaller } = await import("@/server/routers/_app");

import type { Context } from "@/trpc/init";

// Test fixtures - use valid UUIDs
const TEST_DOMAIN = "example.com";
const TEST_DOMAIN_ID = "00000000-0000-0000-0000-000000000001";
const TEST_PROVIDER_ID = "00000000-0000-0000-0000-000000000002";

// Helper to create a caller with optional context overrides
function createTestCaller(contextOverrides: Partial<Context> = {}) {
  const defaultContext: Context = {
    req: undefined,
    ip: "127.0.0.1",
    session: null,
  };
  return createCaller({ ...defaultContext, ...contextOverrides });
}

beforeAll(async () => {
  // Create test provider for registrar
  await db
    .insert(providers)
    .values({
      id: TEST_PROVIDER_ID,
      category: "registrar",
      name: "Unknown",
      slug: "unknown",
    })
    .onConflictDoNothing();

  // Create test domain
  await db
    .insert(domains)
    .values({
      id: TEST_DOMAIN_ID,
      name: TEST_DOMAIN,
      tld: "com",
      unicodeName: TEST_DOMAIN,
    })
    .onConflictDoNothing();
});

afterAll(async () => {
  await closePGliteDb();
});

beforeEach(() => {
  vi.clearAllMocks();
});

describe("domain router", () => {
  describe("input validation", () => {
    it("rejects empty domain", async () => {
      const caller = createTestCaller();

      await expect(
        caller.domain.getRegistration({ domain: "" }),
      ).rejects.toThrow();
    });

    it("rejects invalid domain format", async () => {
      const caller = createTestCaller();

      await expect(
        caller.domain.getRegistration({ domain: "not-a-domain" }),
      ).rejects.toThrow("must be a valid registrable domain");
    });

    it("rejects domain with invalid TLD", async () => {
      const caller = createTestCaller();

      await expect(
        caller.domain.getRegistration({ domain: "example.invalidtld12345" }),
      ).rejects.toThrow("must be a valid registrable domain");
    });

    it("normalizes domain to registrable form", async () => {
      const caller = createTestCaller();

      // Mock service to capture the input
      vi.mocked(fetchRegistration).mockResolvedValue({
        success: true,
        data: {
          domain: "example.com",
          tld: "com",
          isRegistered: true,
          status: "registered",
          source: "rdap",
          registrarProvider: {
            id: TEST_PROVIDER_ID,
            name: "Unknown",
            domain: null,
          },
        },
      });

      // www.example.com should be normalized to example.com
      await caller.domain.getRegistration({ domain: "www.example.com" });

      // The service should be called with the normalized domain
      expect(fetchRegistration).toHaveBeenCalledWith("example.com");
    });

    it("accepts valid domain with subdomain", async () => {
      const caller = createTestCaller();

      vi.mocked(start).mockResolvedValue({
        returnValue: Promise.resolve({
          success: true,
          data: { isRegistered: true },
        }),
      } as never);

      // Should not throw
      await expect(
        caller.domain.getRegistration({ domain: "sub.example.com" }),
      ).resolves.toBeDefined();
    });
  });

  describe("getRegistration", () => {
    it("returns cached data when fresh", async () => {
      const caller = createTestCaller();

      // Insert fresh registration data
      const now = new Date();
      const expiresAt = new Date(now.getTime() + 24 * 60 * 60 * 1000); // 24 hours from now

      await db
        .insert(registrations)
        .values({
          domainId: TEST_DOMAIN_ID,
          isRegistered: true,
          privacyEnabled: false,
          registrarProviderId: TEST_PROVIDER_ID,
          source: "rdap",
          fetchedAt: now,
          expiresAt,
        })
        .onConflictDoUpdate({
          target: registrations.domainId,
          set: {
            isRegistered: true,
            fetchedAt: now,
            expiresAt,
          },
        });

      const result = await caller.domain.getRegistration({
        domain: TEST_DOMAIN,
      });

      // Should return cached data without calling the service
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.cached).toBe(true);
      }
      expect(fetchRegistration).not.toHaveBeenCalled();
    });

    it("fetches fresh data when cache is stale", async () => {
      const caller = createTestCaller();

      // Insert stale registration data
      const now = new Date();
      const expiredAt = new Date(now.getTime() - 60 * 1000); // 1 minute ago

      await db
        .insert(registrations)
        .values({
          domainId: TEST_DOMAIN_ID,
          isRegistered: true,
          privacyEnabled: false,
          registrarProviderId: TEST_PROVIDER_ID,
          source: "rdap",
          fetchedAt: new Date(now.getTime() - 2 * 60 * 60 * 1000),
          expiresAt: expiredAt,
        })
        .onConflictDoUpdate({
          target: registrations.domainId,
          set: {
            fetchedAt: new Date(now.getTime() - 2 * 60 * 60 * 1000),
            expiresAt: expiredAt,
          },
        });

      const result = await caller.domain.getRegistration({
        domain: TEST_DOMAIN,
      });

      // Should fetch fresh data when stale
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.cached).toBe(false);
      }
      expect(fetchRegistration).toHaveBeenCalled();
    });

    it("fetches fresh data when no cached data exists", async () => {
      const caller = createTestCaller();

      // Use a domain that doesn't exist in cache
      const newDomain = "newdomain.com";

      vi.mocked(fetchRegistration).mockResolvedValue({
        success: true,
        data: {
          domain: newDomain,
          tld: "com",
          isRegistered: true,
          status: "registered",
          source: "rdap",
          registrarProvider: {
            id: TEST_PROVIDER_ID,
            name: "Unknown",
            domain: null,
          },
        },
      });

      const result = await caller.domain.getRegistration({ domain: newDomain });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.cached).toBe(false);
      }
      expect(fetchRegistration).toHaveBeenCalled();
    });
  });

  describe("getDnsRecords", () => {
    it("returns cached DNS records when fresh", async () => {
      const caller = createTestCaller();

      // Insert fresh DNS data
      const now = new Date();
      const expiresAt = new Date(now.getTime() + 60 * 60 * 1000); // 1 hour from now

      await db
        .insert(dnsRecords)
        .values({
          domainId: TEST_DOMAIN_ID,
          type: "A",
          name: TEST_DOMAIN,
          value: "93.184.216.34",
          ttl: 300,
          resolver: "cloudflare",
          fetchedAt: now,
          expiresAt,
        })
        .onConflictDoNothing();

      const result = await caller.domain.getDnsRecords({ domain: TEST_DOMAIN });

      expect(result.success).toBe(true);
      if (result.success && result.data) {
        expect(result.cached).toBe(true);
        expect(result.data.records).toBeDefined();
      }
    });

    it("fetches fresh DNS when no cached DNS exists", async () => {
      const caller = createTestCaller();

      const newDomain = "nodns.com";

      vi.mocked(fetchDns).mockResolvedValue({
        success: true,
        data: {
          records: [{ type: "A", name: newDomain, value: "1.2.3.4", ttl: 300 }],
          resolver: "cloudflare",
        },
      });

      const result = await caller.domain.getDnsRecords({ domain: newDomain });

      expect(result.success).toBe(true);
      expect(fetchDns).toHaveBeenCalled();
    });
  });

  describe("getFavicon", () => {
    it("is accessible without authentication (public procedure)", async () => {
      const caller = createTestCaller({ session: null });

      vi.mocked(start).mockResolvedValue({
        returnValue: Promise.resolve({
          success: true,
          data: { url: "https://example.com/favicon.ico" },
        }),
      } as never);

      // Should not throw unauthorized error
      const result = await caller.domain.getFavicon({ domain: TEST_DOMAIN });
      expect(result).toBeDefined();
    });
  });

  describe("service error handling", () => {
    it("returns error result when service returns permanent error", async () => {
      const caller = createTestCaller();

      const failingDomain = "failing.com";

      vi.mocked(fetchRegistration).mockResolvedValue({
        success: false,
        error: "unsupported_tld",
      });

      const result = await caller.domain.getRegistration({
        domain: failingDomain,
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBe("unsupported_tld");
      }
    });
  });
});

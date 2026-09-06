/* @vitest-environment node */
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

// Initialize PGlite before importing anything that uses the db
const { makePGliteDb, closePGliteDb } = await import("@domainstack/db/testing");
const { db } = await makePGliteDb();

// Mock workflow/api to avoid starting real workflows (still used by non-registration procedures)
vi.mock("workflow/api", () => ({
  start: vi.fn<(...args: unknown[]) => Promise<unknown>>().mockResolvedValue({
    runId: "mock-run-id",
    returnValue: Promise.resolve({ success: true, data: {} }),
  }),
}));

// Mock the services (used by getRegistration and getDnsRecords)
vi.mock("@domainstack/server", async (importOriginal) => {
  const original = await importOriginal<typeof import("@domainstack/server")>();
  return {
    ...original,
    fetchRegistration: vi.fn<(...args: unknown[]) => Promise<unknown>>().mockResolvedValue({
      success: true,
      data: {
        isRegistered: true,
        registrarProvider: {
          id: "00000000-0000-0000-0000-000000000002",
          name: "Unknown",
        },
      },
    }),
    fetchDns: vi.fn<(...args: unknown[]) => Promise<unknown>>().mockResolvedValue({
      success: true,
      data: {
        records: [],
        resolver: "cloudflare",
      },
    }),
    fetchHeaders: vi.fn<(...args: unknown[]) => Promise<unknown>>().mockResolvedValue({
      success: true,
      data: {
        headers: [],
        status: 200,
        statusMessage: "OK",
      },
    }),
    fetchFavicon: vi.fn<(...args: unknown[]) => Promise<unknown>>().mockResolvedValue({
      success: true,
      data: { url: "https://example.com/favicon.ico" },
    }),
    fetchCertificates: vi.fn<(...args: unknown[]) => Promise<unknown>>().mockResolvedValue({
      success: true,
      data: {
        certificates: [],
        valid: true,
        validationError: null,
        protocol: "TLSv1.3",
        cipher: "TLS_AES_256_GCM_SHA384",
        publicKeyBits: 256,
        chainComplete: true,
      },
    }),
  };
});

// Mock edge-config
vi.mock("@domainstack/edge-config", () => ({
  getProviderCatalog: vi.fn<(...args: unknown[]) => Promise<unknown>>().mockResolvedValue(null),
}));

// Mock next/headers to avoid errors outside request context
vi.mock("next/headers", () => ({
  headers: vi.fn<() => Promise<Map<string, string>>>().mockResolvedValue(new Map()),
}));

// Mock next/server after() to be a no-op
vi.mock("next/server", () => ({
  after: vi.fn<(fn: () => unknown) => unknown>((fn) => fn()),
}));

// Now import modules that depend on the db
const {
  certificateChecks,
  certificates,
  dnsRecords,
  domains,
  favicons,
  httpHeaders,
  providers,
  registrations,
} = await import("@domainstack/db/schema");
const { start } = await import("workflow/api");
const { fetchCertificates, fetchDns, fetchFavicon, fetchHeaders, fetchRegistration } =
  await import("@domainstack/server");
const { getRateLimiter } = await import("@domainstack/redis/ratelimit");
const { createCaller } = await import("@/server/routers/_app");
const { eq } = await import("@domainstack/db/drizzle");

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

      await expect(caller.domain.getRegistration({ domain: "" })).rejects.toThrow(/./);
    });

    it("rejects invalid domain format", async () => {
      const caller = createTestCaller();

      await expect(caller.domain.getRegistration({ domain: "not-a-domain" })).rejects.toThrow(
        "must be a valid registrable domain",
      );
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
      if (!result.success) {
        throw new Error("Expected getRegistration to succeed");
      }
      expect(result.cached).toBe(true);
      expect(fetchRegistration).not.toHaveBeenCalled();
      expect(getRateLimiter).not.toHaveBeenCalled();
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
      if (!result.success) {
        throw new Error("Expected getRegistration to succeed");
      }
      expect(result.cached).toBe(false);
      expect(fetchRegistration).toHaveBeenCalled();
      expect(getRateLimiter).toHaveBeenCalled();
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
      if (!result.success) {
        throw new Error("Expected getRegistration to succeed");
      }
      expect(result.cached).toBe(false);
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
      if (!result.success) {
        throw new Error("Expected getDnsRecords to succeed");
      }
      if (!result.data) {
        throw new Error("Expected getDnsRecords to return data");
      }
      expect(result.cached).toBe(true);
      expect(result.data.records).toBeDefined();
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

  describe("getHeaders", () => {
    it("attaches a status reason phrase to cached headers", async () => {
      const caller = createTestCaller();

      const now = new Date();
      const expiresAt = new Date(now.getTime() + 60 * 60 * 1000);

      await db
        .insert(httpHeaders)
        .values({
          domainId: TEST_DOMAIN_ID,
          headers: [{ name: "server", value: "nginx" }],
          status: 400,
          fetchedAt: now,
          expiresAt,
        })
        .onConflictDoUpdate({
          target: httpHeaders.domainId,
          set: {
            headers: [{ name: "server", value: "nginx" }],
            status: 400,
            fetchedAt: now,
            expiresAt,
          },
        });

      const result = await caller.domain.getHeaders({ domain: TEST_DOMAIN });

      expect(result.success).toBe(true);
      if (!result.success) {
        throw new Error("Expected getHeaders to succeed");
      }
      expect(result.cached).toBe(true);
      expect(result.data?.status).toBe(400);
      expect(result.data?.statusMessage).toBe("Bad Request");
      expect(fetchHeaders).not.toHaveBeenCalled();
    });
  });

  describe("getFavicon", () => {
    function mockFaviconLimiter() {
      const limit = vi.fn<
        (identifier: string) => Promise<{
          success: true;
          limit: number;
          remaining: number;
          reset: number;
          pending: Promise<void>;
        }>
      >();
      limit.mockResolvedValue({
        success: true,
        limit: 100,
        remaining: 99,
        reset: Date.now() + 60_000,
        pending: Promise.resolve(),
      });
      vi.mocked(getRateLimiter).mockReturnValue({ limit } as never);
      return limit;
    }

    it("is accessible without authentication (public procedure)", async () => {
      const caller = createTestCaller({ session: null });

      // Should not throw unauthorized error
      const result = await caller.domain.getFavicon({ domain: TEST_DOMAIN });
      expect(result).toBeDefined();
    });

    it("does not call limiter.limit on a fresh cache hit", async () => {
      const caller = createTestCaller();
      const limit = mockFaviconLimiter();

      const now = new Date();
      const expiresAt = new Date(now.getTime() + 60 * 60 * 1000);

      await db
        .insert(favicons)
        .values({
          domainId: TEST_DOMAIN_ID,
          url: "https://example.com/favicon.ico",
          pathname: null,
          size: 32,
          source: "google",
          notFound: false,
          fetchedAt: now,
          expiresAt,
        })
        .onConflictDoUpdate({
          target: favicons.domainId,
          set: {
            url: "https://example.com/favicon.ico",
            fetchedAt: now,
            expiresAt,
            notFound: false,
          },
        });

      const result = await caller.domain.getFavicon({ domain: TEST_DOMAIN });

      expect(result).toMatchObject({
        success: true,
        cached: true,
        data: { url: "https://example.com/favicon.ico" },
      });
      expect(limit).not.toHaveBeenCalled();
      expect(fetchFavicon).not.toHaveBeenCalled();
    });

    it("calls limiter.limit on a cache miss", async () => {
      const caller = createTestCaller();
      const limit = mockFaviconLimiter();
      const uncachedDomain = "uncached-favicon.com";

      const result = await caller.domain.getFavicon({ domain: uncachedDomain });

      expect(result).toMatchObject({
        success: true,
        cached: false,
        data: { url: "https://example.com/favicon.ico" },
      });
      expect(limit).toHaveBeenCalled();
      expect(fetchFavicon).toHaveBeenCalled();
    });

    it("calls limiter.limit on a stale cache entry", async () => {
      const caller = createTestCaller();
      const limit = mockFaviconLimiter();

      const now = new Date();
      const expiresAt = new Date(now.getTime() - 60 * 1000);

      await db
        .insert(favicons)
        .values({
          domainId: TEST_DOMAIN_ID,
          url: "https://example.com/old-favicon.ico",
          pathname: null,
          size: 32,
          source: "google",
          notFound: false,
          fetchedAt: new Date(now.getTime() - 2 * 60 * 60 * 1000),
          expiresAt,
        })
        .onConflictDoUpdate({
          target: favicons.domainId,
          set: {
            url: "https://example.com/old-favicon.ico",
            fetchedAt: new Date(now.getTime() - 2 * 60 * 60 * 1000),
            expiresAt,
            notFound: false,
          },
        });

      const result = await caller.domain.getFavicon({ domain: TEST_DOMAIN });

      expect(result).toMatchObject({
        success: true,
        cached: false,
        data: { url: "https://example.com/favicon.ico" },
      });
      expect(limit).toHaveBeenCalled();
      expect(fetchFavicon).toHaveBeenCalled();
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

      expect(result).toMatchObject({ success: false, error: "unsupported_tld" });
    });
  });

  describe("getCertificates", () => {
    const observation = {
      valid: true,
      validationError: null,
      protocol: "TLSv1.3",
      cipher: "TLS_AES_256_GCM_SHA384",
      publicKeyBits: 256,
      chainComplete: true,
    } as const;

    const leaf = {
      issuer: "Test Intermediate CA",
      subject: "example.com",
      altNames: ["example.com"],
      validFrom: "2024-01-01T00:00:00.000Z",
      validTo: "2027-01-01T00:00:00.000Z",
      fingerprint256: "aa".repeat(32),
      serialNumber: "03",
      chainPosition: 0,
      caProvider: { id: null, name: null, domain: null },
    };

    const intermediate = {
      issuer: "Test Root CA",
      subject: "Test Intermediate CA",
      altNames: [] as string[],
      validFrom: "2024-01-01T00:00:00.000Z",
      validTo: "2025-06-01T00:00:00.000Z",
      fingerprint256: "bb".repeat(32),
      serialNumber: "02",
      chainPosition: 1,
      caProvider: { id: null, name: null, domain: null },
    };

    const freshData = {
      certificates: [leaf, intermediate],
      ...observation,
    };

    async function clearCertificateCache() {
      await db.delete(certificates).where(eq(certificates.domainId, TEST_DOMAIN_ID));
      await db.delete(certificateChecks).where(eq(certificateChecks.domainId, TEST_DOMAIN_ID));
    }

    async function insertCachedObservation() {
      const now = new Date();
      const expiresAt = new Date(now.getTime() + 60 * 60 * 1000);
      await db.insert(certificateChecks).values({
        domainId: TEST_DOMAIN_ID,
        ...observation,
        fetchedAt: now,
        expiresAt,
      });
      await db.insert(certificates).values(
        [leaf, intermediate].map((c) => ({
          domainId: TEST_DOMAIN_ID,
          issuer: c.issuer,
          subject: c.subject,
          altNames: c.altNames,
          validFrom: new Date(c.validFrom),
          validTo: new Date(c.validTo),
          fingerprint256: c.fingerprint256,
          serialNumber: c.serialNumber,
          chainPosition: c.chainPosition,
          fetchedAt: now,
          expiresAt,
        })),
      );
    }

    beforeEach(async () => {
      await clearCertificateCache();
      vi.mocked(fetchCertificates).mockResolvedValue({
        success: true,
        data: freshData,
      });
    });

    it("returns cached and fresh responses with the same observation shape", async () => {
      const caller = createTestCaller();
      await insertCachedObservation();

      const cached = await caller.domain.getCertificates({ domain: TEST_DOMAIN });
      expect(cached).toMatchObject({
        success: true,
        cached: true,
        data: freshData,
      });
      expect(fetchCertificates).not.toHaveBeenCalled();

      await clearCertificateCache();
      const fresh = await caller.domain.getCertificates({ domain: TEST_DOMAIN });
      expect(fresh).toMatchObject({
        success: true,
        cached: false,
        data: freshData,
      });
      expect(fetchCertificates).toHaveBeenCalledWith(TEST_DOMAIN);
      expect(fresh.data).toEqual(cached.data);
    });

    it("treats legacy certificate rows without a check as a cache miss", async () => {
      const caller = createTestCaller();
      const now = new Date();
      await db.insert(certificates).values({
        domainId: TEST_DOMAIN_ID,
        issuer: leaf.issuer,
        subject: leaf.subject,
        altNames: leaf.altNames,
        validFrom: new Date(leaf.validFrom),
        validTo: new Date(leaf.validTo),
        fingerprint256: leaf.fingerprint256,
        serialNumber: leaf.serialNumber,
        fetchedAt: now,
        expiresAt: new Date(now.getTime() + 60 * 60 * 1000),
      });

      const result = await caller.domain.getCertificates({ domain: TEST_DOMAIN });

      expect(result).toMatchObject({
        success: true,
        cached: false,
        data: freshData,
      });
      expect(fetchCertificates).toHaveBeenCalledWith(TEST_DOMAIN);
    });
  });
});

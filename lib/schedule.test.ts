/* @vitest-environment node */
import {
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";

let scheduleSectionIfEarlier: typeof import("@/lib/schedule").scheduleSectionIfEarlier;
let scheduleSectionsForDomain: typeof import("@/lib/schedule").scheduleSectionsForDomain;
let scheduleImmediate: typeof import("@/lib/schedule").scheduleImmediate;
let recordFailureAndBackoff: typeof import("@/lib/schedule").recordFailureAndBackoff;
let resetFailureBackoff: typeof import("@/lib/schedule").resetFailureBackoff;
let drainDueDomainsOnce: typeof import("@/lib/schedule").drainDueDomainsOnce;
let allSections: typeof import("@/lib/schedule").allSections;

describe("schedule", () => {
  beforeAll(async () => {
    const { makeInMemoryRedis } = await import("@/lib/redis-mock");
    const impl = makeInMemoryRedis();
    vi.doMock("@/lib/redis", () => impl);
    ({
      scheduleSectionIfEarlier,
      scheduleSectionsForDomain,
      scheduleImmediate,
      recordFailureAndBackoff,
      resetFailureBackoff,
      drainDueDomainsOnce,
      allSections,
    } = await import("@/lib/schedule"));
  });

  beforeEach(async () => {
    const { resetInMemoryRedis } = await import("@/lib/redis-mock");
    resetInMemoryRedis();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("scheduleSectionIfEarlier", () => {
    it("schedules a section when none exists", async () => {
      const now = Date.now();
      const dueAtMs = now + 5000;

      const scheduled = await scheduleSectionIfEarlier(
        "dns",
        "example.com",
        dueAtMs,
      );

      expect(scheduled).toBe(true);

      // Verify it was added to Redis
      const { redis, ns } = await import("@/lib/redis");
      const score = await redis.zscore(ns("due", "dns"), "example.com");
      expect(score).toBeGreaterThanOrEqual(dueAtMs);
    });

    it("updates when new time is earlier", async () => {
      const now = Date.now();
      // Use times well beyond minTTL for dns (1 hour)
      const laterTime = now + 3 * 60 * 60 * 1000; // 3 hours
      const earlierTime = now + 2 * 60 * 60 * 1000; // 2 hours

      await scheduleSectionIfEarlier("dns", "example.com", laterTime);
      const updated = await scheduleSectionIfEarlier(
        "dns",
        "example.com",
        earlierTime,
      );

      expect(updated).toBe(true);

      const { redis, ns } = await import("@/lib/redis");
      const score = await redis.zscore(ns("due", "dns"), "example.com");
      expect(score).toBeLessThan(laterTime);
    });

    it("does not update when new time is later", async () => {
      const now = Date.now();
      // Use times well beyond minTTL for dns (1 hour)
      const earlierTime = now + 2 * 60 * 60 * 1000; // 2 hours
      const laterTime = now + 3 * 60 * 60 * 1000; // 3 hours

      await scheduleSectionIfEarlier("dns", "example.com", earlierTime);
      const updated = await scheduleSectionIfEarlier(
        "dns",
        "example.com",
        laterTime,
      );

      expect(updated).toBe(false);
    });

    it("rejects invalid dueAtMs (negative)", async () => {
      const scheduled = await scheduleSectionIfEarlier(
        "dns",
        "example.com",
        -1000,
      );

      expect(scheduled).toBe(false);
    });

    it("rejects invalid dueAtMs (non-finite)", async () => {
      const scheduled = await scheduleSectionIfEarlier(
        "dns",
        "example.com",
        Number.POSITIVE_INFINITY,
      );

      expect(scheduled).toBe(false);
    });

    it("enforces minimum TTL for section", async () => {
      const now = Date.now();
      const tooSoon = now + 100; // Much less than dns min TTL of 1 hour

      await scheduleSectionIfEarlier("dns", "example.com", tooSoon);

      const { redis, ns } = await import("@/lib/redis");
      const score = await redis.zscore(ns("due", "dns"), "example.com");
      // Should be scheduled at least minTTL in the future
      expect(score).toBeGreaterThanOrEqual(now + 60 * 60 * 1000); // 1 hour min for dns
    });
  });

  describe("scheduleSectionsForDomain", () => {
    it("schedules multiple sections for a domain", async () => {
      const now = Date.now();
      await scheduleSectionsForDomain("example.com", [
        { section: "dns", dueAtMs: now + 5000 },
        { section: "headers", dueAtMs: now + 6000 },
        { section: "hosting", dueAtMs: now + 7000 },
      ]);

      const { redis, ns } = await import("@/lib/redis");
      const dnsScore = await redis.zscore(ns("due", "dns"), "example.com");
      const headersScore = await redis.zscore(
        ns("due", "headers"),
        "example.com",
      );
      const hostingScore = await redis.zscore(
        ns("due", "hosting"),
        "example.com",
      );

      expect(dnsScore).toBeDefined();
      expect(headersScore).toBeDefined();
      expect(hostingScore).toBeDefined();
    });
  });

  describe("scheduleImmediate", () => {
    it("schedules sections with default delay", async () => {
      const now = Date.now();
      await scheduleImmediate("example.com", ["dns", "headers"]);

      const { redis, ns } = await import("@/lib/redis");
      const dnsScore = await redis.zscore(ns("due", "dns"), "example.com");
      const headersScore = await redis.zscore(
        ns("due", "headers"),
        "example.com",
      );

      // Should be scheduled ~1000ms from now (default delay)
      expect(dnsScore).toBeGreaterThanOrEqual(now);
      expect(headersScore).toBeGreaterThanOrEqual(now);
    });

    it("schedules sections with custom delay", async () => {
      const now = Date.now();
      const customDelay = 5000;
      await scheduleImmediate("example.com", ["dns"], customDelay);

      const { redis, ns } = await import("@/lib/redis");
      const dnsScore = await redis.zscore(ns("due", "dns"), "example.com");

      expect(dnsScore).toBeGreaterThanOrEqual(now + customDelay);
    });
  });

  describe("recordFailureAndBackoff", () => {
    it("records first failure and applies base backoff", async () => {
      const now = Date.now();
      const nextAtMs = await recordFailureAndBackoff("dns", "example.com");

      const { BACKOFF_BASE_SECS } = await import("@/lib/constants");
      // Should be at least the configured base backoff
      expect(nextAtMs).toBeGreaterThanOrEqual(now + BACKOFF_BASE_SECS * 1000);

      // Verify attempt count was incremented
      const { redis, ns } = await import("@/lib/redis");
      const attempts = await redis.hget(ns("task", "dns"), "example.com");
      expect(attempts).toBe("1");
    });

    it("applies exponential backoff on repeated failures", async () => {
      const now = Date.now();

      // First failure
      const firstBackoff = await recordFailureAndBackoff("dns", "example.com");
      expect(firstBackoff).toBeGreaterThanOrEqual(now + 5 * 60 * 1000);

      // Second failure (should be ~10 minutes)
      const secondBackoff = await recordFailureAndBackoff("dns", "example.com");
      expect(secondBackoff).toBeGreaterThanOrEqual(firstBackoff);

      // Third failure (should be ~20 minutes)
      const thirdBackoff = await recordFailureAndBackoff("dns", "example.com");
      expect(thirdBackoff).toBeGreaterThanOrEqual(secondBackoff);

      const { redis, ns } = await import("@/lib/redis");
      const attempts = await redis.hget(ns("task", "dns"), "example.com");
      expect(attempts).toBe("3");
    });

    it("caps backoff at maximum (6 hours)", async () => {
      const { redis, ns } = await import("@/lib/redis");

      // Simulate many failures to hit the cap
      await redis.hset(ns("task", "dns"), { "example.com": "20" });

      const now = Date.now();
      const nextAtMs = await recordFailureAndBackoff("dns", "example.com");

      const { BACKOFF_MAX_SECS } = await import("@/lib/constants");
      // Should be capped at configured maximum
      const maxBackoffMs = BACKOFF_MAX_SECS * 1000;
      expect(nextAtMs).toBeLessThanOrEqual(now + maxBackoffMs + 100); // small tolerance
    });
  });

  describe("resetFailureBackoff", () => {
    it("clears failure count for domain", async () => {
      const { redis, ns } = await import("@/lib/redis");

      // Record some failures
      await recordFailureAndBackoff("dns", "example.com");
      await recordFailureAndBackoff("dns", "example.com");

      const beforeReset = await redis.hget(ns("task", "dns"), "example.com");
      expect(beforeReset).toBe("2");

      // Reset
      await resetFailureBackoff("dns", "example.com");

      const afterReset = await redis.hget(ns("task", "dns"), "example.com");
      expect(afterReset).toBeNull();
    });
  });

  describe("drainDueDomainsOnce", () => {
    it("returns empty result when no domains are due", async () => {
      const result = await drainDueDomainsOnce();

      expect(result.events).toHaveLength(0);
      expect(result.groups).toBe(0);
    });

    it("drains a single due domain for one section", async () => {
      const { redis, ns } = await import("@/lib/redis");
      const now = Date.now();

      // Add a due domain
      await redis.zadd(ns("due", "dns"), {
        score: now - 1000,
        member: "example.com",
      });

      const result = await drainDueDomainsOnce();

      expect(result.events).toHaveLength(1);
      expect(result.groups).toBe(1);
      expect(result.events[0]).toEqual({
        name: "section/revalidate",
        data: {
          domain: "example.com",
          sections: ["dns"],
        },
      });
    });

    it("groups multiple sections for same domain", async () => {
      const { redis, ns } = await import("@/lib/redis");
      const now = Date.now();

      // Add same domain to multiple sections
      await redis.zadd(ns("due", "dns"), {
        score: now - 1000,
        member: "example.com",
      });
      await redis.zadd(ns("due", "headers"), {
        score: now - 1000,
        member: "example.com",
      });

      const result = await drainDueDomainsOnce();

      expect(result.events).toHaveLength(1);
      expect(result.groups).toBe(1);
      expect(result.events[0].data.domain).toBe("example.com");
      expect(result.events[0].data.sections).toContain("dns");
      expect(result.events[0].data.sections).toContain("headers");
    });

    it("handles multiple different domains", async () => {
      const { redis, ns } = await import("@/lib/redis");
      const now = Date.now();

      // Add multiple domains
      await redis.zadd(ns("due", "dns"), {
        score: now - 1000,
        member: "example.com",
      });
      await redis.zadd(ns("due", "dns"), {
        score: now - 1000,
        member: "test.com",
      });

      const result = await drainDueDomainsOnce();

      expect(result.events).toHaveLength(2);
      expect(result.groups).toBe(2);

      const domains = result.events.map((e) => e.data.domain);
      expect(domains).toContain("example.com");
      expect(domains).toContain("test.com");
    });

    it("respects lease mechanism (does not drain if lease exists)", async () => {
      const { redis, ns } = await import("@/lib/redis");
      const now = Date.now();

      // Add a due domain
      await redis.zadd(ns("due", "dns"), {
        score: now - 1000,
        member: "example.com",
      });

      // Set an existing lease
      const { LEASE_SECS } = await import("@/lib/constants");
      await redis.set(ns("lease", "dns", "example.com"), "1", {
        ex: LEASE_SECS,
      });

      const result = await drainDueDomainsOnce();

      // Should not drain the domain since lease is held
      expect(result.events).toHaveLength(0);
      expect(result.groups).toBe(0);
    });

    it("does not drain domains that are not yet due", async () => {
      const { redis, ns } = await import("@/lib/redis");
      const now = Date.now();

      // Add a domain that's due in the future
      await redis.zadd(ns("due", "dns"), {
        score: now + 10000,
        member: "example.com",
      });

      const result = await drainDueDomainsOnce();

      expect(result.events).toHaveLength(0);
      expect(result.groups).toBe(0);
    });

    it("respects per-section batch limits", async () => {
      const { redis, ns } = await import("@/lib/redis");
      const now = Date.now();

      // Add many domains to a single section (more than PER_SECTION_BATCH)
      const { PER_SECTION_BATCH } = await import("@/lib/constants");
      const batchSize = PER_SECTION_BATCH;
      for (let i = 0; i < batchSize + 20; i++) {
        await redis.zadd(ns("due", "dns"), {
          score: now - 1000,
          member: `example${i}.com`,
        });
      }

      const result = await drainDueDomainsOnce();

      // Should not exceed per-section batch limit
      expect(result.events.length).toBeLessThanOrEqual(batchSize);
    });

    it("respects global event limit", async () => {
      const { redis, ns } = await import("@/lib/redis");
      const now = Date.now();

      // Add many domains across multiple sections
      const { MAX_EVENTS_PER_RUN } = await import("@/lib/constants");
      const globalMax = MAX_EVENTS_PER_RUN;
      for (let i = 0; i < globalMax + 50; i++) {
        await redis.zadd(ns("due", "dns"), {
          score: now - 1000,
          member: `example${i}.com`,
        });
      }

      const result = await drainDueDomainsOnce();

      // Should not exceed global limit
      expect(result.events.length).toBeLessThanOrEqual(globalMax);
    });
  });

  describe("helper functions", () => {
    it("allSections returns all section types", () => {
      const sections = allSections();

      expect(sections).toContain("dns");
      expect(sections).toContain("headers");
      expect(sections).toContain("hosting");
      expect(sections).toContain("certificates");
      expect(sections).toContain("seo");
      expect(sections).toContain("registration");
      expect(sections).toHaveLength(6);
    });
  });

  describe("scheduleSectionIfEarlier with decay", () => {
    it("applies 3x decay multiplier for DNS accessed 5 days ago", async () => {
      const now = Date.now();
      const msPerDay = 24 * 60 * 60 * 1000;
      const fiveDaysAgo = new Date(now - 5 * msPerDay);
      const baseDueMs = now + 60 * 60 * 1000; // 1 hour from now

      await scheduleSectionIfEarlier(
        "dns",
        "example.com",
        baseDueMs,
        fiveDaysAgo,
      );

      const { redis, ns } = await import("@/lib/redis");
      const score = await redis.zscore(ns("due", "dns"), "example.com");

      // Should be scheduled ~3x later due to decay (3 hours instead of 1 hour)
      const expectedMs = now + 3 * 60 * 60 * 1000;
      expect(score).toBeGreaterThanOrEqual(expectedMs - 1000); // small tolerance
      expect(score).toBeLessThanOrEqual(expectedMs + 60 * 60 * 1000); // within reason
    });

    it("applies 50x decay multiplier for registration accessed 75 days ago", async () => {
      const now = Date.now();
      const msPerDay = 24 * 60 * 60 * 1000;
      const seventyFiveDaysAgo = new Date(now - 75 * msPerDay);
      const baseDueMs = now + 24 * 60 * 60 * 1000; // 24 hours from now

      await scheduleSectionIfEarlier(
        "registration",
        "example.com",
        baseDueMs,
        seventyFiveDaysAgo,
      );

      const { redis, ns } = await import("@/lib/redis");
      const score = await redis.zscore(
        ns("due", "registration"),
        "example.com",
      );

      // Should be scheduled ~50x later due to decay (50 days instead of 1 day)
      const expectedMs = now + 50 * 24 * 60 * 60 * 1000;
      expect(score).toBeGreaterThanOrEqual(expectedMs - 1000);
    });

    it("does not schedule when domain is inactive beyond cutoff (DNS > 180 days)", async () => {
      const now = Date.now();
      const msPerDay = 24 * 60 * 60 * 1000;
      const twoHundredDaysAgo = new Date(now - 200 * msPerDay);

      const scheduled = await scheduleSectionIfEarlier(
        "dns",
        "example.com",
        now + 60 * 60 * 1000,
        twoHundredDaysAgo,
      );

      expect(scheduled).toBe(false);

      const { redis, ns } = await import("@/lib/redis");
      const score = await redis.zscore(ns("due", "dns"), "example.com");
      expect(score).toBeNull();
    });

    it("does not schedule when domain is inactive beyond cutoff (registration > 90 days)", async () => {
      const now = Date.now();
      const msPerDay = 24 * 60 * 60 * 1000;
      const oneHundredDaysAgo = new Date(now - 100 * msPerDay);

      const scheduled = await scheduleSectionIfEarlier(
        "registration",
        "example.com",
        now + 24 * 60 * 60 * 1000,
        oneHundredDaysAgo,
      );

      expect(scheduled).toBe(false);

      const { redis, ns } = await import("@/lib/redis");
      const score = await redis.zscore(
        ns("due", "registration"),
        "example.com",
      );
      expect(score).toBeNull();
    });

    it("uses normal cadence when lastAccessedAt is null", async () => {
      const now = Date.now();
      const baseDueMs = now + 60 * 60 * 1000; // 1 hour from now

      await scheduleSectionIfEarlier("dns", "example.com", baseDueMs, null);

      const { redis, ns } = await import("@/lib/redis");
      const score = await redis.zscore(ns("due", "dns"), "example.com");

      // Should be scheduled at normal cadence (1 hour), not decayed
      expect(score).toBeGreaterThanOrEqual(baseDueMs);
      expect(score).toBeLessThanOrEqual(baseDueMs + 60 * 60 * 1000); // reasonable buffer
    });
  });
});

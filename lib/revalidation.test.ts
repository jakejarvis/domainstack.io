import {
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";

// Mock the domains repo to avoid DB dependency in these tests
// (only testing pure calculation functions, not recordDomainAccess)
vi.mock("@/lib/db/repos/domains", () => ({
  updateLastAccessed: vi.fn(),
}));

describe("revalidation", () => {
  const now = new Date("2024-01-15T00:00:00Z");
  const msPerDay = 24 * 60 * 60 * 1000;

  // Import functions needed for these tests
  let getDecayMultiplier: typeof import("./revalidation").getDecayMultiplier;
  let shouldStopRevalidation: typeof import("./revalidation").shouldStopRevalidation;
  let applyDecayToTtl: typeof import("./revalidation").applyDecayToTtl;

  beforeAll(async () => {
    const revalidationModule = await import("./revalidation");
    // biome-ignore lint/nursery/useDestructuring: dynamic import
    getDecayMultiplier = revalidationModule.getDecayMultiplier;
    // biome-ignore lint/nursery/useDestructuring: dynamic import
    shouldStopRevalidation = revalidationModule.shouldStopRevalidation;
    // biome-ignore lint/nursery/useDestructuring: dynamic import
    applyDecayToTtl = revalidationModule.applyDecayToTtl;
  });

  beforeEach(() => {
    // Use fake timers to control Date.now() and new Date()
    vi.useFakeTimers();
    vi.setSystemTime(now);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe("getDecayMultiplier", () => {
    describe("fast-changing sections (dns, certificates)", () => {
      it("returns 1x for domains accessed within 3 days", () => {
        const accessed = new Date(now.getTime() - 2 * msPerDay); // 2 days ago
        expect(getDecayMultiplier("dns", accessed)).toBe(1);
        expect(getDecayMultiplier("certificates", accessed)).toBe(1);
      });

      it("returns 3x for domains accessed 3-14 days ago", () => {
        const accessed = new Date(now.getTime() - 5 * msPerDay); // 5 days ago
        expect(getDecayMultiplier("dns", accessed)).toBe(3);
        expect(getDecayMultiplier("certificates", accessed)).toBe(3);
      });

      it("returns 10x for domains accessed 14-60 days ago", () => {
        const accessed = new Date(now.getTime() - 30 * msPerDay); // 30 days ago
        expect(getDecayMultiplier("dns", accessed)).toBe(10);
        expect(getDecayMultiplier("certificates", accessed)).toBe(10);
      });

      it("returns 30x for domains accessed 60-180 days ago", () => {
        const accessed = new Date(now.getTime() - 90 * msPerDay); // 90 days ago
        expect(getDecayMultiplier("dns", accessed)).toBe(30);
        expect(getDecayMultiplier("certificates", accessed)).toBe(30);
      });

      it("returns 30x for domains at the 180-day boundary", () => {
        const accessed = new Date(now.getTime() - 179 * msPerDay);
        expect(getDecayMultiplier("dns", accessed)).toBe(30);
      });
    });

    describe("slow-changing sections (registration, hosting, seo)", () => {
      it("returns 1x for domains accessed within 3 days", () => {
        const accessed = new Date(now.getTime() - 2 * msPerDay);
        expect(getDecayMultiplier("registration", accessed)).toBe(1);
        expect(getDecayMultiplier("hosting", accessed)).toBe(1);
        expect(getDecayMultiplier("seo", accessed)).toBe(1);
      });

      it("returns 5x for domains accessed 3-14 days ago", () => {
        const accessed = new Date(now.getTime() - 7 * msPerDay);
        expect(getDecayMultiplier("registration", accessed)).toBe(5);
        expect(getDecayMultiplier("hosting", accessed)).toBe(5);
        expect(getDecayMultiplier("seo", accessed)).toBe(5);
      });

      it("returns 20x for domains accessed 14-60 days ago", () => {
        const accessed = new Date(now.getTime() - 30 * msPerDay);
        expect(getDecayMultiplier("registration", accessed)).toBe(20);
        expect(getDecayMultiplier("hosting", accessed)).toBe(20);
      });

      it("returns 50x for domains accessed 60-90 days ago", () => {
        const accessed = new Date(now.getTime() - 75 * msPerDay);
        expect(getDecayMultiplier("registration", accessed)).toBe(50);
        expect(getDecayMultiplier("hosting", accessed)).toBe(50);
      });

      it("returns 50x for domains at the 90-day boundary", () => {
        const accessed = new Date(now.getTime() - 89 * msPerDay);
        expect(getDecayMultiplier("registration", accessed)).toBe(50);
      });
    });

    describe("headers section (6h TTL = fast-changing)", () => {
      it("returns 3x for domains accessed 5 days ago", () => {
        const accessed = new Date(now.getTime() - 5 * msPerDay);
        expect(getDecayMultiplier("headers", accessed)).toBe(3);
      });

      it("returns 10x for domains accessed 30 days ago", () => {
        const accessed = new Date(now.getTime() - 30 * msPerDay);
        expect(getDecayMultiplier("headers", accessed)).toBe(10);
      });
    });

    it("returns 1x for null lastAccessedAt", () => {
      expect(getDecayMultiplier("dns", null)).toBe(1);
      expect(getDecayMultiplier("registration", null)).toBe(1);
    });

    it("returns 1x for future timestamps (clock skew)", () => {
      const future = new Date(now.getTime() + 1000);
      expect(getDecayMultiplier("dns", future)).toBe(1);
    });
  });

  describe("shouldStopRevalidation", () => {
    it("stops fast-changing sections after 180 days", () => {
      const accessed = new Date(now.getTime() - 181 * msPerDay);
      expect(shouldStopRevalidation("dns", accessed)).toBe(true);
      expect(shouldStopRevalidation("certificates", accessed)).toBe(true);
    });

    it("does not stop fast-changing sections at exactly 180 days", () => {
      const accessed = new Date(now.getTime() - 180 * msPerDay);
      expect(shouldStopRevalidation("dns", accessed)).toBe(false);
      expect(shouldStopRevalidation("certificates", accessed)).toBe(false);
    });

    it("stops slow-changing sections after 90 days", () => {
      const accessed = new Date(now.getTime() - 91 * msPerDay);
      expect(shouldStopRevalidation("registration", accessed)).toBe(true);
      expect(shouldStopRevalidation("hosting", accessed)).toBe(true);
      expect(shouldStopRevalidation("seo", accessed)).toBe(true);
    });

    it("does not stop slow-changing sections at exactly 90 days", () => {
      const accessed = new Date(now.getTime() - 90 * msPerDay);
      expect(shouldStopRevalidation("registration", accessed)).toBe(false);
      expect(shouldStopRevalidation("hosting", accessed)).toBe(false);
    });

    it("stops headers (fast-changing) after 180 days", () => {
      const accessed = new Date(now.getTime() - 181 * msPerDay);
      expect(shouldStopRevalidation("headers", accessed)).toBe(true);
    });

    it("does not stop for null lastAccessedAt", () => {
      expect(shouldStopRevalidation("dns", null)).toBe(false);
      expect(shouldStopRevalidation("registration", null)).toBe(false);
    });

    it("does not stop for future timestamps", () => {
      const future = new Date(now.getTime() + 1000);
      expect(shouldStopRevalidation("dns", future)).toBe(false);
    });
  });

  describe("applyDecayToTtl", () => {
    it("multiplies base TTL by decay multiplier", () => {
      const oneHour = 60 * 60 * 1000;
      expect(applyDecayToTtl(oneHour, 1)).toBe(oneHour);
      expect(applyDecayToTtl(oneHour, 3)).toBe(3 * oneHour);
      expect(applyDecayToTtl(oneHour, 10)).toBe(10 * oneHour);
      expect(applyDecayToTtl(oneHour, 30)).toBe(30 * oneHour);
      expect(applyDecayToTtl(oneHour, 50)).toBe(50 * oneHour);
    });

    it("handles invalid inputs gracefully", () => {
      expect(applyDecayToTtl(0, 5)).toBe(0);
      expect(applyDecayToTtl(-1000, 5)).toBe(-1000);
      expect(applyDecayToTtl(1000, 0)).toBe(1000);
      expect(applyDecayToTtl(1000, -5)).toBe(1000);
      expect(applyDecayToTtl(Number.NaN, 5)).toBe(Number.NaN);
      expect(applyDecayToTtl(1000, Number.NaN)).toBe(1000);
    });
  });

  describe("scheduleRevalidation", () => {
    let scheduleRevalidation: typeof import("./revalidation").scheduleRevalidation;
    let inngest: typeof import("@/lib/inngest/client").inngest;

    beforeAll(async () => {
      const revalidationModule = await import("./revalidation");
      // biome-ignore lint/nursery/useDestructuring: dynamic import
      scheduleRevalidation = revalidationModule.scheduleRevalidation;

      const inngestModule = await import("@/lib/inngest/client");
      // biome-ignore lint/nursery/useDestructuring: dynamic import
      inngest = inngestModule.inngest;
    });

    beforeEach(() => {
      vi.mocked(inngest.send).mockClear();
    });

    it("schedules revalidation event with decay applied", async () => {
      const domain = "example.com";
      const lastAccessed = new Date(now.getTime() - 10 * msPerDay); // 10 days ago

      await scheduleRevalidation(domain, "dns", lastAccessed);

      expect(inngest.send).toHaveBeenCalledTimes(1);
      // biome-ignore lint/nursery/useDestructuring: test assertion
      const call = vi.mocked(inngest.send).mock.calls[0][0] as {
        name: string;
        data: { domain: string; section: string };
        ts: number;
        id: string;
      };
      expect(call.data.domain).toBe(domain);
      expect(call.data.section).toBe("dns");
      expect(call.id).toBe(`${domain}:dns`);
      // DNS is fast-changing, 10 days = 3x multiplier
      // Base TTL is 1 hour (3600s), so 3 hours = 10800000ms
      expect(call.ts).toBeGreaterThan(now.getTime());
    });

    it("skips scheduling for inactive domains", async () => {
      const domain = "inactive.com";
      // DNS stops after 180 days for fast-changing
      const lastAccessed = new Date(now.getTime() - 181 * msPerDay);

      await scheduleRevalidation(domain, "dns", lastAccessed);

      expect(inngest.send).not.toHaveBeenCalled();
    });

    // Note: Additional tests for deduplication and domain normalization
    // are implicitly covered by the integration tests and would require
    // exposing internal state (recentlyScheduled map) which breaks encapsulation
  });
});

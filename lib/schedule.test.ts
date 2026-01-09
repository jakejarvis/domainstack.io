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

// Mock the domains repo to avoid DB dependency in these tests
vi.mock("@/lib/db/repos/domains", () => ({
  updateLastAccessed: vi.fn(),
}));

let scheduleRevalidation: typeof import("@/lib/schedule").scheduleRevalidation;

// Mock Inngest client
const mockInngestSend = vi.fn();

describe("schedule", () => {
  beforeAll(async () => {
    // Mock Inngest client
    vi.doMock("@/lib/inngest/client", () => ({
      inngest: {
        send: mockInngestSend,
      },
    }));

    ({ scheduleRevalidation } = await import("@/lib/schedule"));
  });

  beforeEach(() => {
    mockInngestSend.mockClear();
    mockInngestSend.mockResolvedValue(undefined);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("scheduleRevalidation", () => {
    it("sends Inngest event with correct parameters", async () => {
      const now = Date.now();
      const dueAtMs = now + 5000;

      const scheduled = await scheduleRevalidation(
        "example.test",
        "dns",
        dueAtMs,
      );

      expect(scheduled).toBe(true);
      expect(mockInngestSend).toHaveBeenCalledWith({
        name: "domain/section.revalidate",
        data: {
          domain: "example.test",
          section: "dns",
        },
        ts: expect.any(Number),
        id: "example.test:dns",
      });
    });

    it("normalizes domain to lowercase", async () => {
      const now = Date.now();
      const dueAtMs = now + 5000;

      await scheduleRevalidation("EXAMPLE.TEST", "dns", dueAtMs);

      expect(mockInngestSend).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            domain: "example.test",
          }),
        }),
      );
    });

    it("rejects invalid dueAtMs (negative)", async () => {
      const scheduled = await scheduleRevalidation(
        "example.test",
        "dns",
        -1000,
      );

      expect(scheduled).toBe(false);
      expect(mockInngestSend).not.toHaveBeenCalled();
    });

    it("rejects invalid dueAtMs (non-finite)", async () => {
      const scheduled = await scheduleRevalidation(
        "example.test",
        "dns",
        Number.POSITIVE_INFINITY,
      );

      expect(scheduled).toBe(false);
      expect(mockInngestSend).not.toHaveBeenCalled();
    });

    it("adjusts timestamp when dueAtMs is in the past (prevents negative timeout)", async () => {
      const now = Date.now();
      const pastTimestamp = now - 5000; // 5 seconds ago

      const scheduled = await scheduleRevalidation(
        "example.test",
        "headers",
        pastTimestamp,
      );

      expect(scheduled).toBe(true);
      expect(mockInngestSend).toHaveBeenCalled();

      const [callArgs] = mockInngestSend.mock.calls[0];
      // Should be adjusted to at least now + minTTL (6 hours for headers)
      const minTtlMs = 6 * 60 * 60 * 1000; // 6 hours
      expect(callArgs.ts).toBeGreaterThan(now);
      expect(callArgs.ts).toBeGreaterThanOrEqual(now + minTtlMs - 100); // small tolerance
    });

    it("adjusts timestamp when dueAtMs equals current time (edge case)", async () => {
      const now = Date.now();

      const scheduled = await scheduleRevalidation("example.test", "dns", now);

      expect(scheduled).toBe(true);
      expect(mockInngestSend).toHaveBeenCalled();

      const [callArgs] = mockInngestSend.mock.calls[0];
      // Should be adjusted to now + minTTL (1 hour for dns)
      const minTtlMs = 60 * 60 * 1000; // 1 hour
      expect(callArgs.ts).toBeGreaterThan(now);
      expect(callArgs.ts).toBeGreaterThanOrEqual(now + minTtlMs - 100); // small tolerance
    });

    it("enforces minimum TTL for section", async () => {
      const now = Date.now();
      const tooSoon = now + 100; // Much less than dns min TTL of 1 hour

      await scheduleRevalidation("example.test", "dns", tooSoon);

      expect(mockInngestSend).toHaveBeenCalledWith(
        expect.objectContaining({
          ts: expect.any(Number),
        }),
      );

      const [callArgs] = mockInngestSend.mock.calls[0];
      // Should be scheduled at least minTTL in the future
      expect(callArgs.ts).toBeGreaterThanOrEqual(now + 60 * 60 * 1000); // 1 hour min for dns
    });

    it("handles Inngest send errors gracefully", async () => {
      const now = Date.now();
      mockInngestSend.mockRejectedValue(new Error("Network error"));

      const scheduled = await scheduleRevalidation(
        "example.test",
        "dns",
        now + 5000,
      );

      expect(scheduled).toBe(false);
    });
  });

  describe("scheduleRevalidation with decay", () => {
    it("applies 3x decay multiplier for DNS accessed 5 days ago", async () => {
      const now = Date.now();
      const msPerDay = 24 * 60 * 60 * 1000;
      const fiveDaysAgo = new Date(now - 5 * msPerDay);
      const baseDueMs = now + 60 * 60 * 1000; // 1 hour from now

      await scheduleRevalidation("example.test", "dns", baseDueMs, fiveDaysAgo);

      expect(mockInngestSend).toHaveBeenCalled();
      const [callArgs] = mockInngestSend.mock.calls[0];

      // Should be scheduled ~3x later due to decay (3 hours instead of 1 hour)
      const expectedMs = now + 3 * 60 * 60 * 1000;
      expect(callArgs.ts).toBeGreaterThanOrEqual(expectedMs - 1000); // small tolerance
      expect(callArgs.ts).toBeLessThanOrEqual(expectedMs + 60 * 60 * 1000); // within reason
    });

    it("applies 50x decay multiplier for registration accessed 75 days ago", async () => {
      const now = Date.now();
      const msPerDay = 24 * 60 * 60 * 1000;
      const seventyFiveDaysAgo = new Date(now - 75 * msPerDay);
      const baseDueMs = now + 24 * 60 * 60 * 1000; // 24 hours from now

      await scheduleRevalidation(
        "example.test",
        "registration",
        baseDueMs,
        seventyFiveDaysAgo,
      );

      expect(mockInngestSend).toHaveBeenCalled();
      const [callArgs] = mockInngestSend.mock.calls[0];

      // Should be scheduled ~50x later due to decay (50 days instead of 1 day)
      const expectedMs = now + 50 * 24 * 60 * 60 * 1000;
      expect(callArgs.ts).toBeGreaterThanOrEqual(expectedMs - 1000);
    });

    it("does not schedule when domain is inactive beyond cutoff (DNS > 180 days)", async () => {
      const now = Date.now();
      const msPerDay = 24 * 60 * 60 * 1000;
      const twoHundredDaysAgo = new Date(now - 200 * msPerDay);

      const scheduled = await scheduleRevalidation(
        "example.test",
        "dns",
        now + 60 * 60 * 1000,
        twoHundredDaysAgo,
      );

      expect(scheduled).toBe(false);
      expect(mockInngestSend).not.toHaveBeenCalled();
    });

    it("does not schedule when domain is inactive beyond cutoff (registration > 90 days)", async () => {
      const now = Date.now();
      const msPerDay = 24 * 60 * 60 * 1000;
      const oneHundredDaysAgo = new Date(now - 100 * msPerDay);

      const scheduled = await scheduleRevalidation(
        "example.test",
        "registration",
        now + 24 * 60 * 60 * 1000,
        oneHundredDaysAgo,
      );

      expect(scheduled).toBe(false);
      expect(mockInngestSend).not.toHaveBeenCalled();
    });

    it("uses normal cadence when lastAccessedAt is null", async () => {
      const now = Date.now();
      const baseDueMs = now + 60 * 60 * 1000; // 1 hour from now

      await scheduleRevalidation("example.test", "dns", baseDueMs, null);

      expect(mockInngestSend).toHaveBeenCalled();
      const [callArgs] = mockInngestSend.mock.calls[0];

      // Should be scheduled at normal cadence (1 hour), not decayed
      expect(callArgs.ts).toBeGreaterThanOrEqual(baseDueMs);
      expect(callArgs.ts).toBeLessThanOrEqual(baseDueMs + 60 * 60 * 1000); // reasonable buffer
    });
  });
});

import { describe, expect, it, vi } from "vitest";

import { settleInBatches, startInBatches } from "@/lib/batch";

describe("settleInBatches", () => {
  it("returns settled results in input order, including rejections", async () => {
    const items = [1, 2, 3, 4, 5];
    const results = await settleInBatches(items, 2, async (n) => {
      if (n === 3) throw new Error("boom");
      return n * 10;
    });

    expect(results).toEqual([
      { status: "fulfilled", value: 10 },
      { status: "fulfilled", value: 20 },
      { status: "rejected", reason: new Error("boom") },
      { status: "fulfilled", value: 40 },
      { status: "fulfilled", value: 50 },
    ]);
  });

  it("never runs more than batchSize calls concurrently", async () => {
    const items = Array.from({ length: 23 }, (_, i) => i);
    let inFlight = 0;
    let maxInFlight = 0;

    await settleInBatches(items, 5, async (n) => {
      inFlight++;
      maxInFlight = Math.max(maxInFlight, inFlight);
      await Promise.resolve();
      inFlight--;
      return n;
    });

    expect(maxInFlight).toBe(5);
  });

  it("returns an empty array and never calls fn for empty input", async () => {
    let called = false;
    const results = await settleInBatches([], 5, async () => {
      called = true;
      return null;
    });

    expect(results).toEqual([]);
    expect(called).toBe(false);
  });
});

describe("startInBatches", () => {
  it("returns the success count and warns once with a sample error on failures", async () => {
    const logger = { warn: vi.fn<(obj: object, msg: string) => void>() };
    const boom = new Error("boom");

    const started = await startInBatches(
      [1, 2, 3, 4],
      2,
      async (n) => {
        if (n % 2 === 0) throw boom;
      },
      logger,
    );

    expect(started).toBe(2);
    expect(logger.warn).toHaveBeenCalledTimes(1);
    expect(logger.warn).toHaveBeenCalledWith(
      { failed: 2, total: 4, err: boom },
      "Some workflow starts failed",
    );
  });

  it("does not warn when every start succeeds", async () => {
    const logger = { warn: vi.fn<(obj: object, msg: string) => void>() };
    expect(await startInBatches([1, 2, 3], 2, async () => {}, logger)).toBe(3);
    expect(logger.warn).not.toHaveBeenCalled();
  });
});

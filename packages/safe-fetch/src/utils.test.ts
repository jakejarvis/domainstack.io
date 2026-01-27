import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { sleep, withRetry, withTimeout } from "./utils";

describe("withTimeout", () => {
  it("returns result when operation completes in time", async () => {
    const result = await withTimeout(async () => "success", 1000);
    expect(result).toBe("success");
  });

  it("throws when operation times out", async () => {
    await expect(
      withTimeout(async (signal) => {
        await sleep(500, signal);
        return "too slow";
      }, 10),
    ).rejects.toThrow("Aborted");
  });

  it("passes abort signal to operation", async () => {
    let signalReceived: AbortSignal | undefined;
    await withTimeout(async (signal) => {
      signalReceived = signal;
    }, 1000);
    expect(signalReceived).toBeDefined();
    expect(signalReceived?.aborted).toBe(false);
  });
});

describe("withRetry", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("returns result on first success", async () => {
    let attempts = 0;
    const promise = withRetry(async () => {
      attempts++;
      return "success";
    });
    const result = await promise;
    expect(result).toBe("success");
    expect(attempts).toBe(1);
  });

  it("retries on failure and succeeds", async () => {
    let attempts = 0;
    const promise = withRetry(
      async () => {
        attempts++;
        if (attempts < 3) throw new Error("fail");
        return "success";
      },
      { retries: 3, delayMs: 100 },
    );

    // First attempt fails immediately
    await vi.advanceTimersByTimeAsync(0);
    // Wait for first retry delay (100ms)
    await vi.advanceTimersByTimeAsync(100);
    // Wait for second retry delay (200ms)
    await vi.advanceTimersByTimeAsync(200);

    const result = await promise;
    expect(result).toBe("success");
    expect(attempts).toBe(3);
  });

  it("throws last error when all retries exhausted", async () => {
    vi.useRealTimers(); // Real timers for rejection test
    let attempts = 0;
    await expect(
      withRetry(
        async () => {
          attempts++;
          throw new Error(`attempt ${attempts}`);
        },
        { retries: 2, delayMs: 1 },
      ),
    ).rejects.toThrow("attempt 3");
    expect(attempts).toBe(3);
  });

  it("uses exponential backoff", async () => {
    let attempts = 0;
    const promise = withRetry(
      async () => {
        attempts++;
        if (attempts < 4) throw new Error("fail");
        return "done";
      },
      { retries: 3, delayMs: 100 },
    );

    // First attempt is immediate
    await vi.advanceTimersByTimeAsync(0);
    expect(attempts).toBe(1);

    // First retry after 100ms (100 * 2^0)
    await vi.advanceTimersByTimeAsync(100);
    expect(attempts).toBe(2);

    // Second retry after 200ms (100 * 2^1)
    await vi.advanceTimersByTimeAsync(200);
    expect(attempts).toBe(3);

    // Third retry after 400ms (100 * 2^2)
    await vi.advanceTimersByTimeAsync(400);
    expect(attempts).toBe(4);

    await promise;
  });
});

describe("sleep", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("resolves after specified time", async () => {
    const promise = sleep(100);
    vi.advanceTimersByTime(100);
    await expect(promise).resolves.toBeUndefined();
  });

  it("rejects immediately when signal is already aborted", async () => {
    vi.useRealTimers();
    const controller = new AbortController();
    controller.abort();
    await expect(sleep(1000, controller.signal)).rejects.toThrow("Aborted");
  });

  it("rejects when signal is aborted during sleep", async () => {
    vi.useRealTimers();
    const controller = new AbortController();
    const promise = sleep(1000, controller.signal);
    setTimeout(() => controller.abort(), 10);
    await expect(promise).rejects.toThrow("Aborted");
  });
});

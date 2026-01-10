import { describe, expect, it, vi } from "vitest";
import {
  createTimeoutSignal,
  sleep,
  withRetry,
  withTimeout,
  withTimeoutAndRetry,
} from "./async";

describe("createTimeoutSignal", () => {
  it("creates a signal that aborts after timeout", async () => {
    const { signal, cleanup } = createTimeoutSignal({ timeoutMs: 50 });

    expect(signal.aborted).toBe(false);

    await new Promise((resolve) => setTimeout(resolve, 100));

    expect(signal.aborted).toBe(true);
    cleanup();
  });

  it("cleanup prevents abort after cleanup is called", async () => {
    const { signal, cleanup } = createTimeoutSignal({ timeoutMs: 50 });

    cleanup();
    await new Promise((resolve) => setTimeout(resolve, 100));

    expect(signal.aborted).toBe(false);
  });

  it("combines with external signal", async () => {
    const externalController = new AbortController();
    const { signal, cleanup } = createTimeoutSignal({
      timeoutMs: 1000,
      signal: externalController.signal,
    });

    expect(signal.aborted).toBe(false);

    externalController.abort();

    // Give it a tick to propagate
    await new Promise((resolve) => setTimeout(resolve, 10));

    expect(signal.aborted).toBe(true);
    cleanup();
  });
});

describe("withTimeout", () => {
  it("returns result for fast operations", async () => {
    const result = await withTimeout(
      async () => {
        await new Promise((resolve) => setTimeout(resolve, 10));
        return "success";
      },
      { timeoutMs: 100 },
    );

    expect(result).toBe("success");
  });

  it("throws for slow operations", async () => {
    await expect(
      withTimeout(
        async (signal) => {
          await new Promise((resolve, reject) => {
            const id = setTimeout(resolve, 200);
            signal.addEventListener("abort", () => {
              clearTimeout(id);
              reject(new Error("aborted"));
            });
          });
          return "success";
        },
        { timeoutMs: 50 },
      ),
    ).rejects.toThrow();
  });

  it("passes signal to operation", async () => {
    const signalReceived = vi.fn();

    await withTimeout(
      async (signal) => {
        signalReceived(signal);
        return "done";
      },
      { timeoutMs: 100 },
    );

    expect(signalReceived).toHaveBeenCalledWith(expect.any(AbortSignal));
  });
});

describe("withRetry", () => {
  it("returns result on first success", async () => {
    const operation = vi.fn().mockResolvedValue("success");

    const result = await withRetry(operation, { retries: 3 });

    expect(result).toBe("success");
    expect(operation).toHaveBeenCalledTimes(1);
  });

  it("retries on failure", async () => {
    const operation = vi
      .fn()
      .mockRejectedValueOnce(new Error("fail 1"))
      .mockRejectedValueOnce(new Error("fail 2"))
      .mockResolvedValue("success");

    const result = await withRetry(operation, { retries: 3, delayMs: 10 });

    expect(result).toBe("success");
    expect(operation).toHaveBeenCalledTimes(3);
  });

  it("throws after all retries exhausted", async () => {
    const operation = vi.fn().mockRejectedValue(new Error("always fails"));

    await expect(
      withRetry(operation, { retries: 2, delayMs: 10 }),
    ).rejects.toThrow("always fails");

    expect(operation).toHaveBeenCalledTimes(3); // 1 initial + 2 retries
  });

  it("respects shouldRetry predicate", async () => {
    const operation = vi
      .fn()
      .mockRejectedValueOnce(new Error("retryable"))
      .mockRejectedValueOnce(new Error("not retryable"));

    await expect(
      withRetry(operation, {
        retries: 3,
        delayMs: 10,
        shouldRetry: (err) =>
          err instanceof Error && err.message === "retryable",
      }),
    ).rejects.toThrow("not retryable");

    expect(operation).toHaveBeenCalledTimes(2);
  });

  it("calls onRetry callback", async () => {
    const onRetry = vi.fn();
    const operation = vi
      .fn()
      .mockRejectedValueOnce(new Error("fail"))
      .mockResolvedValue("success");

    await withRetry(operation, { retries: 1, delayMs: 10, onRetry });

    expect(onRetry).toHaveBeenCalledTimes(1);
    expect(onRetry).toHaveBeenCalledWith(expect.any(Error), 0, 10);
  });

  it("uses exponential backoff when configured", async () => {
    const onRetry = vi.fn();
    const operation = vi
      .fn()
      .mockRejectedValueOnce(new Error("fail 1"))
      .mockRejectedValueOnce(new Error("fail 2"))
      .mockRejectedValueOnce(new Error("fail 3"))
      .mockResolvedValue("success");

    await withRetry(operation, {
      retries: 3,
      delayMs: 100,
      backoffMultiplier: 2,
      onRetry,
    });

    // Delays: 100 * 2^0 = 100, 100 * 2^1 = 200, 100 * 2^2 = 400
    expect(onRetry).toHaveBeenNthCalledWith(1, expect.any(Error), 0, 100);
    expect(onRetry).toHaveBeenNthCalledWith(2, expect.any(Error), 1, 200);
    expect(onRetry).toHaveBeenNthCalledWith(3, expect.any(Error), 2, 400);
  });

  it("respects maxDelayMs", async () => {
    const onRetry = vi.fn();
    const operation = vi
      .fn()
      .mockRejectedValueOnce(new Error("fail 1"))
      .mockRejectedValueOnce(new Error("fail 2"))
      .mockResolvedValue("success");

    await withRetry(operation, {
      retries: 2,
      delayMs: 100,
      backoffMultiplier: 10,
      maxDelayMs: 500,
      onRetry,
    });

    // Delays would be 100, 1000 but capped at 500
    expect(onRetry).toHaveBeenNthCalledWith(1, expect.any(Error), 0, 100);
    expect(onRetry).toHaveBeenNthCalledWith(2, expect.any(Error), 1, 500);
  });

  it("aborts on signal", async () => {
    const controller = new AbortController();
    const operation = vi.fn().mockRejectedValue(new Error("fail"));

    setTimeout(() => controller.abort(), 50);

    await expect(
      withRetry(operation, {
        retries: 10,
        delayMs: 100,
        signal: controller.signal,
      }),
    ).rejects.toThrow();

    // Should have stopped early due to abort
    expect(operation.mock.calls.length).toBeLessThan(10);
  });
});

describe("sleep", () => {
  it("resolves after delay", async () => {
    const start = Date.now();
    await sleep(50);
    const elapsed = Date.now() - start;

    expect(elapsed).toBeGreaterThanOrEqual(40);
    expect(elapsed).toBeLessThan(100);
  });

  it("rejects when aborted", async () => {
    const controller = new AbortController();
    setTimeout(() => controller.abort(), 10);

    await expect(sleep(1000, controller.signal)).rejects.toThrow(
      "Sleep aborted",
    );
  });

  it("rejects immediately if already aborted", async () => {
    const controller = new AbortController();
    controller.abort();

    await expect(sleep(1000, controller.signal)).rejects.toThrow(
      "Sleep aborted",
    );
  });
});

describe("withTimeoutAndRetry", () => {
  it("combines timeout and retry", async () => {
    const operation = vi
      .fn()
      .mockRejectedValueOnce(new Error("fail"))
      .mockResolvedValue("success");

    const result = await withTimeoutAndRetry(async () => operation(), {
      timeoutMs: 100,
      retries: 2,
      delayMs: 10,
    });

    expect(result).toBe("success");
    expect(operation).toHaveBeenCalledTimes(2);
  });

  it("retries on timeout", async () => {
    let attempts = 0;
    const operation = vi
      .fn()
      .mockImplementation(async (signal: AbortSignal) => {
        attempts++;
        if (attempts < 2) {
          // First attempt: simulate slow operation
          await new Promise((resolve, reject) => {
            const id = setTimeout(resolve, 200);
            signal.addEventListener("abort", () => {
              clearTimeout(id);
              reject(new Error("aborted"));
            });
          });
        }
        return "success";
      });

    const result = await withTimeoutAndRetry(operation, {
      timeoutMs: 50,
      retries: 2,
      delayMs: 10,
    });

    expect(result).toBe("success");
    expect(attempts).toBe(2);
  });
});

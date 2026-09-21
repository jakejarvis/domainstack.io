import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { sleep, withTimeout } from "./utils";

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

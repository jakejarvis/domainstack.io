import { afterEach, describe, expect, it, vi } from "vitest";

import {
  isAwaitingScheduledRetry,
  isTerminalState,
  pollDelayMs,
  pollScreenshot,
  runIdFromState,
  startScreenshot,
} from "./screenshot";

function mockFetch(body: unknown, init?: ResponseInit) {
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => Response.json(body, init)),
  );
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("startScreenshot", () => {
  it("posts the row id, or the hostname when there is no id", async () => {
    mockFetch({ status: "running", runId: "run-1" });
    await startScreenshot({ domainId: "domain-1" });
    await startScreenshot({ domain: "api.example.com" });

    const calls = vi.mocked(fetch).mock.calls;
    expect(JSON.parse(calls[0][1]?.body as string)).toEqual({ domainId: "domain-1" });
    expect(JSON.parse(calls[1][1]?.body as string)).toEqual({ domain: "api.example.com" });
  });

  it("returns a running run or a cached result", async () => {
    mockFetch({ status: "running", runId: "run-1" });
    await expect(startScreenshot({ domainId: "domain-1" })).resolves.toEqual({
      status: "running",
      runId: "run-1",
    });

    mockFetch({ status: "completed", success: true, data: { url: "https://x.test/a.png" } });
    await expect(startScreenshot({ domainId: "domain-1" })).resolves.toEqual({
      status: "completed",
      source: "cache",
      data: { url: "https://x.test/a.png", blocked: false },
    });
  });

  it("treats a completed-but-unsuccessful capture as failed", async () => {
    mockFetch({ status: "completed", success: false, error: "Blocked by robots" });
    await expect(startScreenshot({ domainId: "domain-1" })).resolves.toEqual({
      status: "failed",
      error: "Blocked by robots",
    });
  });

  it("maps 429 to rate_limited and other 4xx to failed, but throws on 5xx", async () => {
    mockFetch({}, { status: 429, headers: { "Retry-After": "7" } });
    await expect(startScreenshot({ domainId: "domain-1" })).resolves.toMatchObject({
      status: "rate_limited",
      retryAfter: 7,
    });

    mockFetch({ error: "Nope" }, { status: 403 });
    await expect(startScreenshot({ domainId: "domain-1" })).resolves.toEqual({
      status: "failed",
      error: "Nope",
    });

    mockFetch({ error: "Boom" }, { status: 500 });
    await expect(startScreenshot({ domainId: "domain-1" })).rejects.toThrow("Boom");
  });
});

describe("pollScreenshot", () => {
  it("keeps the polled run id and marks results as coming from the workflow", async () => {
    mockFetch({ status: "running" });
    await expect(pollScreenshot("run-1")).resolves.toEqual({ status: "running", runId: "run-1" });

    mockFetch({ status: "completed", data: { url: null, blocked: true } });
    await expect(pollScreenshot("run-1")).resolves.toEqual({
      status: "completed",
      source: "workflow",
      data: { url: null, blocked: true },
    });
  });

  it("throws on an unrecognized payload so the caller backs off", async () => {
    mockFetch({ status: "weird" });
    await expect(pollScreenshot("run-1")).rejects.toThrow("Unknown screenshot response format");
  });
});

describe("state helpers", () => {
  it("treats only completed and non-recoverable failures as terminal", () => {
    expect(
      isTerminalState({
        status: "completed",
        source: "cache",
        data: { url: null, blocked: false },
      }),
    ).toBe(true);
    expect(isTerminalState({ status: "failed", error: "x" })).toBe(true);
    expect(isTerminalState({ status: "failed", error: "x", recoverable: true })).toBe(false);
    expect(isTerminalState({ status: "running", runId: "r" })).toBe(false);
  });

  it("waits for the scheduled retry while backing off or rate limited", () => {
    expect(isAwaitingScheduledRetry({ status: "retrying", attempt: 1, runId: "r" })).toBe(true);
    expect(isAwaitingScheduledRetry({ status: "rate_limited", retryAfter: 3 })).toBe(true);
    expect(isAwaitingScheduledRetry({ status: "failed", error: "x", recoverable: true })).toBe(
      true,
    );
    expect(isAwaitingScheduledRetry({ status: "running", runId: "r" })).toBe(false);
    expect(isAwaitingScheduledRetry({ status: "failed", error: "x" })).toBe(false);
    expect(isAwaitingScheduledRetry(undefined)).toBe(false);
  });

  it("carries the run id through non-terminal states", () => {
    expect(runIdFromState({ status: "retrying", attempt: 2, runId: "r" })).toBe("r");
    expect(runIdFromState({ status: "rate_limited", retryAfter: 3 })).toBeUndefined();
  });

  it("schedules the next poll by state", () => {
    expect(pollDelayMs({ status: "running", runId: "r" })).toBe(2000);
    expect(pollDelayMs({ status: "rate_limited", retryAfter: 3 })).toBe(3000);
    expect(pollDelayMs({ status: "failed", error: "x" })).toBe(false);
    expect(pollDelayMs({ status: "failed", error: "x", recoverable: true })).toBe(300_000);

    const backoff = pollDelayMs({ status: "retrying", attempt: 3 });
    expect(backoff).toBeGreaterThanOrEqual(20_000);
    expect(backoff).toBeLessThan(20_500);
  });
});

/* @vitest-environment node */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fetchWithTimeoutAndRetry } from "@/lib/fetch";

const originalFetch = globalThis.fetch;

function createResponse(init: Partial<Response> = {}): Response {
  // Minimal Response-like object for our assertions
  return {
    ok: init.ok ?? true,
    status: init.status ?? 200,
    url: init.url ?? "https://example.com/",
    headers: init.headers ?? new Headers(),
    arrayBuffer: async () => new ArrayBuffer(0),
    blob: async () => new Blob([]),
    formData: async () => new FormData(),
    json: async () => ({}),
    text: async () => "",
    redirected: false,
    statusText: "",
    type: "basic",
    body: null,
    bodyUsed: false,
    clone() {
      return createResponse(init);
    },
  } as unknown as Response;
}

describe("lib/fetch", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    globalThis.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it("resolves before timeout", async () => {
    const res = createResponse({ ok: true, status: 200 });
    globalThis.fetch = vi.fn(
      async () => res as Response,
    ) as unknown as typeof fetch;

    const out = await fetchWithTimeoutAndRetry(
      "https://example.com",
      {},
      { timeoutMs: 50 },
    );
    expect(out).toBe(res);
    expect(globalThis.fetch).toHaveBeenCalledTimes(1);
  });

  describe("with real timers", () => {
    beforeEach(() => {
      // Override parent beforeEach - use real timers to avoid PromiseRejectionHandledWarning
      vi.useRealTimers();
    });

    it("aborts after timeout and rejects", async () => {
      globalThis.fetch = vi.fn((_input, init) => {
        const signal = (init as RequestInit | undefined)?.signal as
          | AbortSignal
          | undefined;
        return new Promise<Response>((_resolve, reject) => {
          if (signal) {
            signal.addEventListener("abort", () => {
              reject(new Error("aborted"));
            });
          }
        });
      }) as unknown as typeof fetch;

      await expect(
        fetchWithTimeoutAndRetry("https://slow.test", {}, { timeoutMs: 10 }),
      ).rejects.toThrow("aborted");
    });
  });

  it("retries once and then succeeds", async () => {
    const res = createResponse({ ok: true, status: 200 });
    const mock = vi
      .fn()
      .mockRejectedValueOnce(new Error("network"))
      .mockResolvedValueOnce(res);
    globalThis.fetch = mock as unknown as typeof fetch;

    const p = fetchWithTimeoutAndRetry(
      "https://flaky.test",
      {},
      {
        timeoutMs: 25,
        retries: 1,
        backoffMs: 5,
      },
    );
    // First attempt fails immediately; wait for backoff and second attempt
    await vi.runAllTimersAsync();
    const out = await p;
    expect(out).toBe(res);
    expect(mock).toHaveBeenCalledTimes(2);
  }, 5000); // 5s timeout for retry logic
});

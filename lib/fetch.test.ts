/* @vitest-environment node */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  fetchWithSelectiveRedirects,
  fetchWithTimeoutAndRetry,
} from "@/lib/fetch";

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

  describe("fetchWithSelectiveRedirects", () => {
    it("returns non-redirect responses immediately", async () => {
      const res = createResponse({ ok: true, status: 200 });
      globalThis.fetch = vi.fn(async () => res) as unknown as typeof fetch;

      const out = await fetchWithSelectiveRedirects(
        "https://example.com",
        {},
        { timeoutMs: 50 },
      );
      expect(out).toBe(res);
      expect(globalThis.fetch).toHaveBeenCalledTimes(1);
    });

    it("follows redirect from http to https on same domain", async () => {
      const redirectRes = createResponse({
        status: 301,
        headers: new Headers({ location: "https://example.com/" }),
      });
      const finalRes = createResponse({ ok: true, status: 200 });

      const mock = vi
        .fn()
        .mockResolvedValueOnce(redirectRes)
        .mockResolvedValueOnce(finalRes);
      globalThis.fetch = mock as unknown as typeof fetch;

      const out = await fetchWithSelectiveRedirects(
        "http://example.com/",
        {},
        { timeoutMs: 50 },
      );
      expect(out).toBe(finalRes);
      expect(mock).toHaveBeenCalledTimes(2);
      expect(mock).toHaveBeenNthCalledWith(
        1,
        "http://example.com/",
        expect.objectContaining({ redirect: "manual" }),
      );
      expect(mock).toHaveBeenNthCalledWith(
        2,
        "https://example.com/",
        expect.objectContaining({ redirect: "manual" }),
      );
    });

    it("follows redirect from apex to www", async () => {
      const redirectRes = createResponse({
        status: 301,
        headers: new Headers({ location: "https://www.example.com/" }),
      });
      const finalRes = createResponse({ ok: true, status: 200 });

      const mock = vi
        .fn()
        .mockResolvedValueOnce(redirectRes)
        .mockResolvedValueOnce(finalRes);
      globalThis.fetch = mock as unknown as typeof fetch;

      const out = await fetchWithSelectiveRedirects(
        "https://example.com/",
        {},
        { timeoutMs: 50 },
      );
      expect(out).toBe(finalRes);
      expect(mock).toHaveBeenCalledTimes(2);
    });

    it("follows redirect from www to apex", async () => {
      const redirectRes = createResponse({
        status: 301,
        headers: new Headers({ location: "https://example.com/" }),
      });
      const finalRes = createResponse({ ok: true, status: 200 });

      const mock = vi
        .fn()
        .mockResolvedValueOnce(redirectRes)
        .mockResolvedValueOnce(finalRes);
      globalThis.fetch = mock as unknown as typeof fetch;

      const out = await fetchWithSelectiveRedirects(
        "https://www.example.com/",
        {},
        { timeoutMs: 50 },
      );
      expect(out).toBe(finalRes);
      expect(mock).toHaveBeenCalledTimes(2);
    });

    it("follows redirect from http://example.com to https://www.example.com", async () => {
      const redirectRes = createResponse({
        status: 301,
        headers: new Headers({ location: "https://www.example.com/" }),
      });
      const finalRes = createResponse({ ok: true, status: 200 });

      const mock = vi
        .fn()
        .mockResolvedValueOnce(redirectRes)
        .mockResolvedValueOnce(finalRes);
      globalThis.fetch = mock as unknown as typeof fetch;

      const out = await fetchWithSelectiveRedirects(
        "http://example.com/",
        {},
        { timeoutMs: 50 },
      );
      expect(out).toBe(finalRes);
      expect(mock).toHaveBeenCalledTimes(2);
    });

    it("does NOT follow redirect to different domain", async () => {
      const redirectRes = createResponse({
        status: 301,
        headers: new Headers({ location: "https://other.com/" }),
      });

      globalThis.fetch = vi.fn(
        async () => redirectRes,
      ) as unknown as typeof fetch;

      const out = await fetchWithSelectiveRedirects(
        "https://example.com/",
        {},
        { timeoutMs: 50 },
      );
      expect(out).toBe(redirectRes);
      expect(globalThis.fetch).toHaveBeenCalledTimes(1);
    });

    it("follows redirect to different path on same domain", async () => {
      const redirectRes = createResponse({
        status: 301,
        headers: new Headers({ location: "https://example.com/other-path" }),
      });
      const finalRes = createResponse({ ok: true, status: 200 });

      const mock = vi
        .fn()
        .mockResolvedValueOnce(redirectRes)
        .mockResolvedValueOnce(finalRes);
      globalThis.fetch = mock as unknown as typeof fetch;

      const out = await fetchWithSelectiveRedirects(
        "https://example.com/",
        {},
        { timeoutMs: 50 },
      );
      expect(out).toBe(finalRes);
      expect(mock).toHaveBeenCalledTimes(2);
    });

    it("follows redirect with query params", async () => {
      const redirectRes = createResponse({
        status: 301,
        headers: new Headers({
          location: "https://example.com/?utm_source=test",
        }),
      });
      const finalRes = createResponse({ ok: true, status: 200 });

      const mock = vi
        .fn()
        .mockResolvedValueOnce(redirectRes)
        .mockResolvedValueOnce(finalRes);
      globalThis.fetch = mock as unknown as typeof fetch;

      const out = await fetchWithSelectiveRedirects(
        "https://example.com/",
        {},
        { timeoutMs: 50 },
      );
      expect(out).toBe(finalRes);
      expect(mock).toHaveBeenCalledTimes(2);
    });

    it("follows redirect with hash fragment", async () => {
      const redirectRes = createResponse({
        status: 301,
        headers: new Headers({
          location: "https://example.com/#section",
        }),
      });
      const finalRes = createResponse({ ok: true, status: 200 });

      const mock = vi
        .fn()
        .mockResolvedValueOnce(redirectRes)
        .mockResolvedValueOnce(finalRes);
      globalThis.fetch = mock as unknown as typeof fetch;

      const out = await fetchWithSelectiveRedirects(
        "https://example.com/",
        {},
        { timeoutMs: 50 },
      );
      expect(out).toBe(finalRes);
      expect(mock).toHaveBeenCalledTimes(2);
    });

    it("follows relative redirect URLs to different path", async () => {
      const redirectRes = createResponse({
        status: 301,
        headers: new Headers({ location: "/main" }),
      });
      const finalRes = createResponse({ ok: true, status: 200 });

      const mock = vi
        .fn()
        .mockResolvedValueOnce(redirectRes)
        .mockResolvedValueOnce(finalRes);
      globalThis.fetch = mock as unknown as typeof fetch;

      const out = await fetchWithSelectiveRedirects(
        "https://www.example.com/",
        {},
        { timeoutMs: 50 },
      );
      expect(out).toBe(finalRes);
      expect(mock).toHaveBeenCalledTimes(2);
      // Second call should use the absolute URL
      expect(mock).toHaveBeenNthCalledWith(
        2,
        "https://www.example.com/main",
        expect.objectContaining({ redirect: "manual" }),
      );
    });

    it("throws on too many redirects", async () => {
      const redirectRes = createResponse({
        status: 301,
        headers: new Headers({ location: "https://www.example.com/" }),
      });

      globalThis.fetch = vi.fn(
        async () => redirectRes,
      ) as unknown as typeof fetch;

      await expect(
        fetchWithSelectiveRedirects(
          "https://example.com/",
          {},
          { timeoutMs: 50, maxRedirects: 2 },
        ),
      ).rejects.toThrow("Too many redirects");
      expect(globalThis.fetch).toHaveBeenCalledTimes(3); // initial + 2 redirects
    });

    it("returns redirect response when no location header", async () => {
      const redirectRes = createResponse({
        status: 301,
        headers: new Headers(),
      });

      globalThis.fetch = vi.fn(
        async () => redirectRes,
      ) as unknown as typeof fetch;

      const out = await fetchWithSelectiveRedirects(
        "https://example.com/",
        {},
        { timeoutMs: 50 },
      );
      expect(out).toBe(redirectRes);
      expect(globalThis.fetch).toHaveBeenCalledTimes(1);
    });

    it("handles redirect chain: http -> https -> www", async () => {
      const redirect1 = createResponse({
        status: 301,
        headers: new Headers({ location: "https://example.com/" }),
      });
      const redirect2 = createResponse({
        status: 301,
        headers: new Headers({ location: "https://www.example.com/" }),
      });
      const finalRes = createResponse({ ok: true, status: 200 });

      const mock = vi
        .fn()
        .mockResolvedValueOnce(redirect1)
        .mockResolvedValueOnce(redirect2)
        .mockResolvedValueOnce(finalRes);
      globalThis.fetch = mock as unknown as typeof fetch;

      const out = await fetchWithSelectiveRedirects(
        "http://example.com/",
        {},
        { timeoutMs: 50 },
      );
      expect(out).toBe(finalRes);
      expect(mock).toHaveBeenCalledTimes(3);
    });
  });
});

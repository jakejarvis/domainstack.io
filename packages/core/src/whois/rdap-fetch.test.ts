import { RdapperError } from "rdapper";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { safeFetch } from "@domainstack/safe-fetch";
/* @vitest-environment node */
import { SafeFetchError } from "@domainstack/safe-fetch/errors";

type SafeFetchResult = Awaited<ReturnType<typeof safeFetch>>;

const { safeFetchMock } = vi.hoisted(() => ({
  safeFetchMock: vi.fn<typeof safeFetch>(),
}));

vi.mock("@domainstack/safe-fetch", () => ({ safeFetch: safeFetchMock }));

import { createRdapFetch } from "./rdap-fetch";

function makeResult(overrides: Partial<SafeFetchResult> = {}): SafeFetchResult {
  return {
    buffer: Buffer.from(JSON.stringify({ ok: true })),
    contentType: "application/rdap+json",
    finalUrl: "https://rdap.example/domain/example.com",
    status: 200,
    ok: true,
    headers: { "content-type": "application/rdap+json" },
    setCookies: [],
    ...overrides,
  };
}

describe("createRdapFetch", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("passes the url, user agent, size cap, http allowance and caller headers to safeFetch", async () => {
    safeFetchMock.mockResolvedValue(makeResult());
    const rdapFetch = createRdapFetch({ userAgent: "test-agent", timeoutMs: 4000 });

    await rdapFetch(new URL("http://rdap.example/domain/example.com"), {
      headers: { Accept: "application/rdap+json" },
    });

    expect(safeFetchMock).toHaveBeenCalledTimes(1);
    const opts = safeFetchMock.mock.calls[0][0];
    expect(opts.url).toBe("http://rdap.example/domain/example.com");
    expect(opts.userAgent).toBe("test-agent");
    expect(opts.maxBytes).toBe(2 * 1024 * 1024);
    expect(opts.allowHttp).toBe(true);
    expect(opts.timeoutMs).toBe(4000);
    expect(opts.headers).toMatchObject({ accept: "application/rdap+json" });
  });

  it("returns a Response matching the safeFetch result", async () => {
    safeFetchMock.mockResolvedValue(
      makeResult({
        status: 429,
        ok: false,
        headers: { "retry-after": "30", "content-type": "application/json" },
        buffer: Buffer.from(JSON.stringify({ errorCode: 429 })),
      }),
    );
    const rdapFetch = createRdapFetch({ timeoutMs: 1000 });

    const res = await rdapFetch("https://rdap.example/domain/example.com");

    expect(res.status).toBe(429);
    expect(res.ok).toBe(false);
    expect(res.headers.get("retry-after")).toBe("30");
    expect(await res.json()).toEqual({ errorCode: 429 });
  });

  it("propagates a SafeFetchError refusal as is", async () => {
    safeFetchMock.mockRejectedValue(new SafeFetchError("host_blocked", "blocked"));
    const rdapFetch = createRdapFetch({ timeoutMs: 1000 });

    await expect(rdapFetch("http://127.0.0.1/domain/example.com")).rejects.toBeInstanceOf(
      SafeFetchError,
    );
  });

  it.each([
    ["timeout", "timeout"],
    ["connection_error", "connect_failed"],
    ["dns_error", "connect_failed"],
  ] as const)(
    "rethrows a safeFetch %s as an RdapperError coded %s, so rdapper's trace keeps it",
    async (safeFetchCode, rdapperCode) => {
      const original = new SafeFetchError(safeFetchCode, "Request failed");
      safeFetchMock.mockRejectedValue(original);
      const rdapFetch = createRdapFetch({ timeoutMs: 1000 });

      const err = await rdapFetch("https://rdap.example/domain/example.com").catch((e) => e);

      expect(err).toBeInstanceOf(RdapperError);
      expect(err).toMatchObject({ code: rdapperCode, message: "Request failed", cause: original });
    },
  );

  it("forwards the dispatcher and combines safeFetch's and rdapper's abort signals", async () => {
    safeFetchMock.mockResolvedValue(makeResult());
    const globalFetch = vi.fn<typeof fetch>().mockResolvedValue(new Response("{}"));
    vi.stubGlobal("fetch", globalFetch);

    const rdapperAbort = new AbortController();
    const rdapFetch = createRdapFetch({ timeoutMs: 1000 });
    await rdapFetch("https://rdap.example/domain/example.com", { signal: rdapperAbort.signal });

    const customFetch = safeFetchMock.mock.calls[0][0].fetch!;
    const safeFetchAbort = new AbortController();
    await customFetch("https://rdap.example/domain/example.com", {
      dispatcher: "d",
      signal: safeFetchAbort.signal,
    } as RequestInit);

    expect(globalFetch).toHaveBeenCalledTimes(1);
    const init = globalFetch.mock.calls[0][1] as RequestInit & { dispatcher?: unknown };
    expect(init.dispatcher).toBe("d");
    expect(init.signal).toBeInstanceOf(AbortSignal);
    expect(init.signal).not.toBe(safeFetchAbort.signal);
    expect(init.signal!.aborted).toBe(false);

    rdapperAbort.abort();
    expect(init.signal!.aborted).toBe(true);
  });

  it("builds a bodiless Response for a 204 result", async () => {
    safeFetchMock.mockResolvedValue(makeResult({ status: 204, buffer: Buffer.alloc(0) }));
    const rdapFetch = createRdapFetch({ timeoutMs: 1000 });

    const res = await rdapFetch("https://rdap.example/domain/example.com");

    expect(res.status).toBe(204);
    expect(res.body).toBeNull();
  });
});

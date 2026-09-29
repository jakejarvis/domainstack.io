/* @vitest-environment node */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const IPV4_CIDRS = ["104.16.0.0/13"];
const IPV6_CIDRS = ["2400:cb00::/32"];

function okResponse(result: unknown) {
  return { ok: true, status: 200, json: async () => ({ result }) } as unknown as Response;
}

/** Load a fresh copy so module-level range caching starts empty. */
async function loadModule() {
  vi.resetModules();
  return import("./cloudflare");
}

describe("isCloudflareIp", () => {
  const fetchMock = vi.fn<typeof globalThis.fetch>();

  beforeEach(() => {
    vi.useFakeTimers();
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("matches IPv4 and IPv6 addresses inside Cloudflare ranges", async () => {
    fetchMock.mockResolvedValue(okResponse({ ipv4_cidrs: IPV4_CIDRS, ipv6_cidrs: IPV6_CIDRS }));
    const { isCloudflareIp } = await loadModule();

    expect(await isCloudflareIp("104.16.1.1")).toBe(true);
    expect(await isCloudflareIp("2400:cb00::1")).toBe(true);
    expect(await isCloudflareIp("8.8.8.8")).toBe(false);
    expect(await isCloudflareIp("not-an-ip")).toBe(false);
  });

  it("fetches the range list only once across many checks", async () => {
    fetchMock.mockResolvedValue(okResponse({ ipv4_cidrs: IPV4_CIDRS, ipv6_cidrs: IPV6_CIDRS }));
    const { isCloudflareIp } = await loadModule();

    await Promise.all([
      isCloudflareIp("104.16.1.1"),
      isCloudflareIp("104.16.2.2"),
      isCloudflareIp("8.8.8.8"),
    ]);

    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("does not cache a negative result produced while the range list is unavailable", async () => {
    fetchMock.mockRejectedValueOnce(new Error("network down"));
    const { isCloudflareIp } = await loadModule();

    expect(await isCloudflareIp("104.16.1.1")).toBe(false);

    // Upstream recovers once the error backoff has elapsed
    fetchMock.mockResolvedValue(okResponse({ ipv4_cidrs: IPV4_CIDRS, ipv6_cidrs: IPV6_CIDRS }));
    vi.advanceTimersByTime(61_000);

    expect(await isCloudflareIp("104.16.1.1")).toBe(true);
  });

  it("backs off instead of refetching while the upstream is failing", async () => {
    fetchMock.mockRejectedValue(new Error("network down"));
    const { isCloudflareIp } = await loadModule();

    expect(await isCloudflareIp("104.16.1.1")).toBe(false);
    expect(await isCloudflareIp("104.16.2.2")).toBe(false);

    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("treats a response with no usable CIDRs as a failure", async () => {
    fetchMock.mockResolvedValueOnce(okResponse({ success: false }));
    const { isCloudflareIp } = await loadModule();

    expect(await isCloudflareIp("104.16.1.1")).toBe(false);

    fetchMock.mockResolvedValue(okResponse({ ipv4_cidrs: IPV4_CIDRS, ipv6_cidrs: IPV6_CIDRS }));
    vi.advanceTimersByTime(61_000);

    expect(await isCloudflareIp("104.16.1.1")).toBe(true);
  });

  it("keeps serving the last known ranges when a refresh fails", async () => {
    fetchMock.mockResolvedValueOnce(okResponse({ ipv4_cidrs: IPV4_CIDRS, ipv6_cidrs: IPV6_CIDRS }));
    const { isCloudflareIp } = await loadModule();

    expect(await isCloudflareIp("104.16.1.1")).toBe(true);

    // A week later the refresh fails; the previous ranges still apply
    fetchMock.mockRejectedValue(new Error("network down"));
    vi.advanceTimersByTime(604_800_001);

    expect(await isCloudflareIp("104.16.2.2")).toBe(true);
  });

  it("gives up on a hung range fetch after the timeout", async () => {
    // Vitest's fake timers do not drive AbortSignal.timeout, so spy on it and
    // hand back a signal this test aborts by hand once the "timeout" elapses.
    const controller = new AbortController();
    const timeoutSpy = vi.spyOn(AbortSignal, "timeout").mockReturnValue(controller.signal);
    fetchMock.mockImplementation(
      (_input, init) =>
        new Promise<Response>((_, reject) => {
          const signal = init?.signal;
          signal?.addEventListener("abort", () => reject(signal.reason));
        }),
    );

    try {
      const { isCloudflareIp } = await loadModule();

      const pending = isCloudflareIp("104.16.1.1");
      expect(timeoutSpy).toHaveBeenCalledWith(3000);

      controller.abort(
        new DOMException("The operation was aborted due to timeout", "TimeoutError"),
      );

      expect(await pending).toBe(false);
    } finally {
      timeoutSpy.mockRestore();
    }
  });

  it("preloadCloudflareRanges starts exactly one fetch that isCloudflareIp reuses", async () => {
    fetchMock.mockResolvedValue(okResponse({ ipv4_cidrs: IPV4_CIDRS, ipv6_cidrs: IPV6_CIDRS }));
    const { isCloudflareIp, preloadCloudflareRanges } = await loadModule();

    preloadCloudflareRanges();
    expect(await isCloudflareIp("104.16.1.1")).toBe(true);

    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});

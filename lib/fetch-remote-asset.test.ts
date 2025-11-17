/* @vitest-environment node */
import { describe, expect, it, vi } from "vitest";
import {
  fetchRemoteAsset,
  type RemoteAssetError,
} from "@/lib/fetch-remote-asset";

// Each test replaces the global fetch/DNS lookup so we can simulate edge cases deterministically.
const fetchMock = vi.hoisted(() => vi.fn());
const dnsLookupMock = vi.hoisted(() =>
  vi.fn(async () => [{ address: "93.184.216.34", family: 4 }]),
);

vi.mock("node:dns/promises", () => ({
  lookup: dnsLookupMock,
}));

describe("fetchRemoteAsset", () => {
  beforeEach(() => {
    fetchMock.mockReset();
    dnsLookupMock.mockReset();
    dnsLookupMock.mockResolvedValue([{ address: "93.184.216.34", family: 4 }]);
    globalThis.fetch = fetchMock as unknown as typeof fetch;
  });

  it("returns buffer and content type for valid asset", async () => {
    const body = new Uint8Array([1, 2, 3]);
    fetchMock.mockResolvedValueOnce(
      new Response(body, {
        status: 200,
        headers: { "content-type": "image/png" },
      }),
    );

    const result = await fetchRemoteAsset({
      url: "https://example.com/image.png",
      maxBytes: 1024,
    });

    expect(Buffer.isBuffer(result.buffer)).toBe(true);
    expect(result.contentType).toBe("image/png");
    expect(result.finalUrl).toBe("https://example.com/image.png");
  });

  it("rejects http URLs when allowHttp not set", async () => {
    await expect(
      fetchRemoteAsset({ url: "http://example.com/file.png" }),
    ).rejects.toMatchObject({
      code: "protocol_not_allowed",
    } satisfies Partial<RemoteAssetError>);
  });

  it("allows http URLs when allowHttp is true", async () => {
    fetchMock.mockResolvedValueOnce(
      new Response(new Uint8Array([1]), { status: 200 }),
    );
    const result = await fetchRemoteAsset({
      url: "http://example.com/icon.png",
      allowHttp: true,
    });
    expect(result.finalUrl).toBe("http://example.com/icon.png");
  });

  it("blocks hosts that resolve to private IPs", async () => {
    dnsLookupMock.mockResolvedValueOnce([{ address: "10.0.0.5", family: 4 }]);
    await expect(
      fetchRemoteAsset({ url: "https://private.example/icon.png" }),
    ).rejects.toMatchObject({
      code: "private_ip",
    } satisfies Partial<RemoteAssetError>);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("follows redirects up to limit", async () => {
    const redirectResponse = new Response(null, {
      status: 302,
      headers: { location: "https://cdn.example.com/img.png" },
    });
    const finalResponse = new Response(new Uint8Array([1, 2, 3]), {
      status: 200,
      headers: { "content-type": "image/png" },
    });
    fetchMock
      .mockResolvedValueOnce(redirectResponse)
      .mockResolvedValueOnce(finalResponse);

    dnsLookupMock
      .mockResolvedValueOnce([{ address: "93.184.216.34", family: 4 }])
      .mockResolvedValueOnce([{ address: "93.184.216.35", family: 4 }]);

    const result = await fetchRemoteAsset({
      url: "https://example.com/img.png",
      maxRedirects: 2,
    });
    expect(result.finalUrl).toBe("https://cdn.example.com/img.png");
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("throws when asset exceeds configured size", async () => {
    const largeBody = new Uint8Array(1024);
    fetchMock.mockResolvedValueOnce(
      new Response(largeBody, {
        status: 200,
        headers: { "content-type": "image/png" },
      }),
    );

    await expect(
      fetchRemoteAsset({
        url: "https://example.com/large.png",
        maxBytes: 10,
      }),
    ).rejects.toMatchObject({
      code: "size_exceeded",
    } satisfies Partial<RemoteAssetError>);
  });
});

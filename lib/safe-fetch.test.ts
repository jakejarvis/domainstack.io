/* @vitest-environment node */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { type SafeFetchError, safeFetch } from "@/lib/safe-fetch";

// Each test replaces the global fetch/DNS lookup so we can simulate edge cases deterministically.
const fetchMock = vi.hoisted(() => vi.fn());
const dohLookupMock = vi.hoisted(() =>
  vi.fn(async () => [{ address: "93.184.216.34", family: 4 }]),
);

vi.mock("@/lib/resolver", () => ({
  dohLookup: dohLookupMock,
}));

describe("safeFetch", () => {
  beforeEach(() => {
    fetchMock.mockReset();
    dohLookupMock.mockReset();
    dohLookupMock.mockResolvedValue([{ address: "93.184.216.34", family: 4 }]);
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

    const result = await safeFetch({
      url: "https://example.test/image.png",
      maxBytes: 1024,
    });

    expect(Buffer.isBuffer(result.buffer)).toBe(true);
    expect(result.contentType).toBe("image/png");
    expect(result.finalUrl).toBe("https://example.test/image.png");
    expect(result.headers).toEqual({
      "content-type": "image/png",
    });
  });

  it("rejects http URLs when allowHttp not set", async () => {
    await expect(
      safeFetch({ url: "http://example.test/file.png" }),
    ).rejects.toMatchObject({
      code: "protocol_not_allowed",
    } satisfies Partial<SafeFetchError>);
  });

  it("allows http URLs when allowHttp is true", async () => {
    fetchMock.mockResolvedValueOnce(
      new Response(new Uint8Array([1]), { status: 200 }),
    );
    const result = await safeFetch({
      url: "http://example.test/icon.png",
      allowHttp: true,
    });
    expect(result.finalUrl).toBe("http://example.test/icon.png");
  });

  it("blocks hosts that resolve to private IPs", async () => {
    dohLookupMock.mockResolvedValueOnce([{ address: "10.0.0.5", family: 4 }]);
    await expect(
      safeFetch({ url: "https://private.example/icon.png" }),
    ).rejects.toMatchObject({
      code: "private_ip",
    } satisfies Partial<SafeFetchError>);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("follows redirects up to limit", async () => {
    const redirectResponse = new Response(null, {
      status: 302,
      headers: { location: "https://cdn.example.test/img.png" },
    });
    const finalResponse = new Response(new Uint8Array([1, 2, 3]), {
      status: 200,
      headers: { "content-type": "image/png" },
    });
    fetchMock
      .mockResolvedValueOnce(redirectResponse)
      .mockResolvedValueOnce(finalResponse);

    dohLookupMock
      .mockResolvedValueOnce([{ address: "93.184.216.34", family: 4 }])
      .mockResolvedValueOnce([{ address: "93.184.216.35", family: 4 }]);

    const result = await safeFetch({
      url: "https://example.test/img.png",
      maxRedirects: 2,
    });
    expect(result.finalUrl).toBe("https://cdn.example.test/img.png");
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
      safeFetch({
        url: "https://example.test/large.png",
        maxBytes: 10,
      }),
    ).rejects.toMatchObject({
      code: "size_exceeded",
    } satisfies Partial<SafeFetchError>);
  });

  it("truncates content when truncateOnLimit is true and size exceeded", async () => {
    const largeBody = new Uint8Array(1024).fill(65); // 1024 bytes of 'A'
    fetchMock.mockResolvedValueOnce(
      new Response(largeBody, {
        status: 200,
        headers: { "content-type": "text/html" },
      }),
    );

    const result = await safeFetch({
      url: "https://example.test/large.html",
      maxBytes: 100,
      truncateOnLimit: true,
    });

    expect(result.buffer.length).toBe(100);
    expect(result.buffer.every((b) => b === 65)).toBe(true);
    expect(result.contentType).toBe("text/html");
  });

  it("returns full content when under limit with truncateOnLimit enabled", async () => {
    const smallBody = new Uint8Array(50).fill(66); // 50 bytes of 'B'
    fetchMock.mockResolvedValueOnce(
      new Response(smallBody, {
        status: 200,
        headers: { "content-type": "text/html" },
      }),
    );

    const result = await safeFetch({
      url: "https://example.test/small.html",
      maxBytes: 100,
      truncateOnLimit: true,
    });

    expect(result.buffer.length).toBe(50);
    expect(result.buffer.every((b) => b === 66)).toBe(true);
  });

  it("skips content-length pre-check when truncateOnLimit is true", async () => {
    const body = new Uint8Array(50).fill(67);
    fetchMock.mockResolvedValueOnce(
      new Response(body, {
        status: 200,
        headers: {
          "content-type": "text/html",
          "content-length": "999999", // Declared size exceeds limit
        },
      }),
    );

    // With truncateOnLimit, should not throw based on content-length header
    const result = await safeFetch({
      url: "https://example.test/page.html",
      maxBytes: 100,
      truncateOnLimit: true,
    });

    expect(result.buffer.length).toBe(50);
  });

  it("supports HEAD method", async () => {
    fetchMock.mockResolvedValueOnce(
      new Response(null, {
        status: 200,
        headers: {
          "content-type": "image/png",
          "content-length": "1234",
        },
      }),
    );

    const result = await safeFetch({
      url: "https://example.test/image.png",
      method: "HEAD",
    });

    expect(fetchMock).toHaveBeenCalledWith(
      "https://example.test/image.png",
      expect.objectContaining({
        method: "HEAD",
      }),
    );
    expect(result.headers).toEqual({
      "content-type": "image/png",
      "content-length": "1234",
    });
  });

  it("defaults to GET method when not specified", async () => {
    const body = new Uint8Array([1, 2, 3]);
    fetchMock.mockResolvedValueOnce(
      new Response(body, {
        status: 200,
        headers: { "content-type": "image/png" },
      }),
    );

    await safeFetch({
      url: "https://example.test/image.png",
      maxBytes: 1024,
    });

    expect(fetchMock).toHaveBeenCalledWith(
      "https://example.test/image.png",
      expect.objectContaining({
        method: "GET",
      }),
    );
  });

  it("returns all response headers", async () => {
    const body = new Uint8Array([1, 2, 3]);
    fetchMock.mockResolvedValueOnce(
      new Response(body, {
        status: 200,
        headers: {
          "content-type": "image/png",
          "cache-control": "max-age=3600",
          "x-custom-header": "test-value",
        },
      }),
    );

    const result = await safeFetch({
      url: "https://example.test/image.png",
      maxBytes: 1024,
    });

    expect(result.headers).toEqual({
      "content-type": "image/png",
      "cache-control": "max-age=3600",
      "x-custom-header": "test-value",
    });
  });

  it("falls back to GET when HEAD returns 405 and fallbackToGetOnHeadFailure is enabled", async () => {
    const headResponse = new Response(null, {
      status: 405,
      statusText: "Method Not Allowed",
    });
    const getResponse = new Response(new Uint8Array([1, 2, 3]), {
      status: 200,
      headers: {
        "content-type": "text/html",
        server: "nginx",
      },
    });

    fetchMock
      .mockResolvedValueOnce(headResponse)
      .mockResolvedValueOnce(getResponse);

    const result = await safeFetch({
      url: "https://example.test/",
      method: "HEAD",
      fallbackToGetOnHeadFailure: true,
    });

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock).toHaveBeenNthCalledWith(
      1,
      "https://example.test/",
      expect.objectContaining({ method: "HEAD" }),
    );
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      "https://example.test/",
      expect.objectContaining({ method: "GET" }),
    );
    expect(result.status).toBe(200);
    expect(result.headers).toEqual({
      "content-type": "text/html",
      server: "nginx",
    });
  });

  it("returns 405 response when HEAD returns 405 and fallbackToGetOnHeadFailure is disabled", async () => {
    const headResponse = new Response(null, {
      status: 405,
      statusText: "Method Not Allowed",
      headers: { server: "nginx" },
    });

    fetchMock.mockResolvedValueOnce(headResponse);

    const result = await safeFetch({
      url: "https://example.test/",
      method: "HEAD",
      fallbackToGetOnHeadFailure: false,
    });

    expect(result.status).toBe(405);
    expect(result.headers).toEqual({ server: "nginx" });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("returns 405 response when initial method is already GET", async () => {
    const getResponse = new Response(null, {
      status: 405,
      statusText: "Method Not Allowed",
      headers: { server: "nginx" },
    });

    fetchMock.mockResolvedValueOnce(getResponse);

    const result = await safeFetch({
      url: "https://example.test/",
      method: "GET",
    });

    expect(result.status).toBe(405);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("handles 405 fallback with redirects", async () => {
    const headResponse = new Response(null, {
      status: 405,
      statusText: "Method Not Allowed",
    });
    const redirectResponse = new Response(null, {
      status: 302,
      headers: { location: "https://cdn.example.test/page" },
    });
    const finalResponse = new Response(new Uint8Array([1, 2, 3]), {
      status: 200,
      headers: { "content-type": "text/html" },
    });

    fetchMock
      .mockResolvedValueOnce(headResponse) // HEAD -> 405
      .mockResolvedValueOnce(redirectResponse) // GET -> 302
      .mockResolvedValueOnce(finalResponse); // GET after redirect -> 200

    dohLookupMock
      .mockResolvedValueOnce([{ address: "93.184.216.34", family: 4 }]) // example.test for HEAD
      .mockResolvedValueOnce([{ address: "93.184.216.34", family: 4 }]) // example.test for GET retry
      .mockResolvedValueOnce([{ address: "93.184.216.35", family: 4 }]); // cdn.example.test for redirect

    const result = await safeFetch({
      url: "https://example.test/",
      method: "HEAD",
      fallbackToGetOnHeadFailure: true,
      maxRedirects: 5,
    });

    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(result.status).toBe(200);
    expect(result.finalUrl).toBe("https://cdn.example.test/page");
  });

  it("only retries once on 405 and returns the second 405 response", async () => {
    const head405Response = new Response(null, {
      status: 405,
      statusText: "Method Not Allowed",
      headers: { server: "nginx" },
    });
    const get405Response = new Response(null, {
      status: 405,
      statusText: "Method Not Allowed",
      headers: { server: "apache" },
    });

    fetchMock
      .mockResolvedValueOnce(head405Response)
      .mockResolvedValueOnce(get405Response);

    const result = await safeFetch({
      url: "https://example.test/",
      method: "HEAD",
      fallbackToGetOnHeadFailure: true,
    });

    // Should only make 2 requests: HEAD (405) -> GET (405) -> return
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(result.status).toBe(405);
    expect(result.headers).toEqual({ server: "apache" });
  });

  it("returns response data for 403 Forbidden status", async () => {
    const body = new Uint8Array([1, 2, 3]);
    fetchMock.mockResolvedValueOnce(
      new Response(body, {
        status: 403,
        headers: {
          "content-type": "text/html",
          server: "nginx",
          "x-frame-options": "DENY",
        },
      }),
    );

    const result = await safeFetch({
      url: "https://example.test/protected",
    });

    expect(result.status).toBe(403);
    expect(result.headers).toEqual({
      "content-type": "text/html",
      server: "nginx",
      "x-frame-options": "DENY",
    });
    expect(Buffer.isBuffer(result.buffer)).toBe(true);
    expect(result.buffer.length).toBe(3);
  });

  it("returns response data for 404 Not Found status", async () => {
    fetchMock.mockResolvedValueOnce(
      new Response(new Uint8Array([]), {
        status: 404,
        headers: {
          "content-type": "text/html",
          server: "cloudflare",
        },
      }),
    );

    const result = await safeFetch({
      url: "https://example.test/not-found",
    });

    expect(result.status).toBe(404);
    expect(result.headers).toEqual({
      "content-type": "text/html",
      server: "cloudflare",
    });
  });

  it("returns response data for 500 Internal Server Error status", async () => {
    fetchMock.mockResolvedValueOnce(
      new Response(new Uint8Array([]), {
        status: 500,
        headers: {
          "content-type": "text/html",
          "retry-after": "3600",
        },
      }),
    );

    const result = await safeFetch({
      url: "https://example.test/error",
    });

    expect(result.status).toBe(500);
    expect(result.headers).toEqual({
      "content-type": "text/html",
      "retry-after": "3600",
    });
  });

  it("returns non-OK response with HEAD method", async () => {
    fetchMock.mockResolvedValueOnce(
      new Response(null, {
        status: 403,
        headers: {
          server: "nginx",
          "x-powered-by": "Express",
        },
      }),
    );

    const result = await safeFetch({
      url: "https://example.test/",
      method: "HEAD",
    });

    expect(result.status).toBe(403);
    expect(result.headers).toEqual({
      server: "nginx",
      "x-powered-by": "Express",
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("returns redirect response when redirecting to disallowed host if returnOnDisallowedRedirect is true", async () => {
    const redirectResponse = new Response(null, {
      status: 302,
      headers: { location: "https://disallowed.test/page" },
    });

    fetchMock.mockResolvedValueOnce(redirectResponse);
    dohLookupMock.mockResolvedValueOnce([
      { address: "93.184.216.34", family: 4 },
    ]);

    const result = await safeFetch({
      url: "https://allowed.test/",
      allowedHosts: ["allowed.test"],
      returnOnDisallowedRedirect: true,
    });

    expect(result.status).toBe(302);
    expect(result.headers.location).toBe("https://disallowed.test/page");
    expect(result.finalUrl).toBe("https://allowed.test/"); // The URL that returned the redirect
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("throws when redirecting to disallowed host if returnOnDisallowedRedirect is false", async () => {
    const redirectResponse = new Response(null, {
      status: 302,
      headers: { location: "https://disallowed.test/page" },
    });

    fetchMock.mockResolvedValueOnce(redirectResponse);
    dohLookupMock.mockResolvedValueOnce([
      { address: "93.184.216.34", family: 4 },
    ]);

    await expect(
      safeFetch({
        url: "https://allowed.test/",
        allowedHosts: ["allowed.test"],
        returnOnDisallowedRedirect: false,
      }),
    ).rejects.toMatchObject({
      code: "host_not_allowed",
    });
  });
});

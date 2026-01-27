import { beforeEach, describe, expect, it, vi } from "vitest";
import { SafeFetchError } from "./errors";
import { safeFetch } from "./safe-fetch";
import type { SafeFetchLogger } from "./types";

// Mock DNS resolution
vi.mock("./dns", () => ({
  resolveHostIps: vi.fn(),
  isExpectedDnsError: vi.fn(() => false),
}));

import { resolveHostIps } from "./dns";

const mockResolveHostIps = vi.mocked(resolveHostIps);

// Silent logger for tests
const silentLogger: SafeFetchLogger = {
  debug: () => {},
  info: () => {},
  warn: () => {},
  error: () => {},
};

// Helper to create mock Response
function mockResponse(
  body: string,
  init?: ResponseInit & { headers?: Record<string, string> },
): Response {
  const headers = new Headers(init?.headers);
  return new Response(body, { ...init, headers });
}

// Helper to create mock fetch
function createMockFetch(response: Response | (() => Response)) {
  return vi.fn(async () =>
    typeof response === "function" ? response() : response,
  );
}

describe("safeFetch", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Default: resolve to public IP
    mockResolveHostIps.mockResolvedValue([
      { address: "93.184.216.34", family: 4 },
    ]);
  });

  describe("basic functionality", () => {
    it("fetches a URL successfully", async () => {
      const mockFetch = createMockFetch(
        mockResponse("Hello, World!", { status: 200 }),
      );

      const result = await safeFetch({
        url: "https://example.com",
        userAgent: "TestBot/1.0",
        fetch: mockFetch,
        logger: silentLogger,
      });

      expect(result.ok).toBe(true);
      expect(result.status).toBe(200);
      expect(result.buffer.toString()).toBe("Hello, World!");
      expect(result.finalUrl).toBe("https://example.com/");
      expect(mockFetch).toHaveBeenCalledTimes(1);
    });

    it("returns HTTP errors without throwing", async () => {
      const mockFetch = createMockFetch(
        mockResponse("Not Found", { status: 404 }),
      );

      const result = await safeFetch({
        url: "https://example.com/missing",
        userAgent: "TestBot/1.0",
        fetch: mockFetch,
        logger: silentLogger,
      });

      expect(result.ok).toBe(false);
      expect(result.status).toBe(404);
      expect(result.buffer.toString()).toBe("Not Found");
    });

    it("uses provided User-Agent header", async () => {
      const mockFetch = createMockFetch(mockResponse("OK", { status: 200 }));

      await safeFetch({
        url: "https://example.com",
        userAgent: "CustomBot/2.0",
        fetch: mockFetch,
        logger: silentLogger,
      });

      expect(mockFetch).toHaveBeenCalledWith(
        "https://example.com/",
        expect.objectContaining({
          headers: expect.objectContaining({ "User-Agent": "CustomBot/2.0" }),
        }),
      );
    });

    it("passes custom headers", async () => {
      const mockFetch = createMockFetch(mockResponse("OK", { status: 200 }));

      await safeFetch({
        url: "https://example.com",
        userAgent: "TestBot/1.0",
        headers: { "X-Custom": "value", Accept: "application/json" },
        fetch: mockFetch,
        logger: silentLogger,
      });

      expect(mockFetch).toHaveBeenCalledWith(
        "https://example.com/",
        expect.objectContaining({
          headers: expect.objectContaining({
            "X-Custom": "value",
            Accept: "application/json",
          }),
        }),
      );
    });

    it("resolves relative URLs with currentUrl base", async () => {
      const mockFetch = createMockFetch(mockResponse("OK", { status: 200 }));

      const result = await safeFetch({
        url: "/path/to/resource",
        currentUrl: "https://example.com/base/",
        userAgent: "TestBot/1.0",
        fetch: mockFetch,
        logger: silentLogger,
      });

      expect(result.finalUrl).toBe("https://example.com/path/to/resource");
    });
  });

  describe("protocol validation", () => {
    it("allows HTTPS by default", async () => {
      const mockFetch = createMockFetch(mockResponse("OK", { status: 200 }));

      const result = await safeFetch({
        url: "https://example.com",
        userAgent: "TestBot/1.0",
        fetch: mockFetch,
        logger: silentLogger,
      });

      expect(result.ok).toBe(true);
    });

    it("blocks HTTP by default", async () => {
      const mockFetch = createMockFetch(mockResponse("OK", { status: 200 }));

      await expect(
        safeFetch({
          url: "http://example.com",
          userAgent: "TestBot/1.0",
          fetch: mockFetch,
          logger: silentLogger,
        }),
      ).rejects.toThrow(SafeFetchError);

      await expect(
        safeFetch({
          url: "http://example.com",
          userAgent: "TestBot/1.0",
          fetch: mockFetch,
          logger: silentLogger,
        }),
      ).rejects.toMatchObject({ code: "protocol_not_allowed" });
    });

    it("allows HTTP when allowHttp is true", async () => {
      const mockFetch = createMockFetch(mockResponse("OK", { status: 200 }));

      const result = await safeFetch({
        url: "http://example.com",
        userAgent: "TestBot/1.0",
        allowHttp: true,
        fetch: mockFetch,
        logger: silentLogger,
      });

      expect(result.ok).toBe(true);
    });

    it("blocks non-HTTP protocols", async () => {
      const mockFetch = createMockFetch(mockResponse("OK", { status: 200 }));

      await expect(
        safeFetch({
          url: "ftp://example.com",
          userAgent: "TestBot/1.0",
          fetch: mockFetch,
          logger: silentLogger,
        }),
      ).rejects.toMatchObject({ code: "protocol_not_allowed" });
    });
  });

  describe("blocked hostnames", () => {
    it("blocks localhost", async () => {
      const mockFetch = createMockFetch(mockResponse("OK", { status: 200 }));

      await expect(
        safeFetch({
          url: "https://localhost",
          userAgent: "TestBot/1.0",
          fetch: mockFetch,
          logger: silentLogger,
        }),
      ).rejects.toMatchObject({ code: "host_blocked" });
    });

    it("blocks .local domains", async () => {
      const mockFetch = createMockFetch(mockResponse("OK", { status: 200 }));

      await expect(
        safeFetch({
          url: "https://myserver.local",
          userAgent: "TestBot/1.0",
          fetch: mockFetch,
          logger: silentLogger,
        }),
      ).rejects.toMatchObject({ code: "host_blocked" });
    });

    it("blocks .internal domains", async () => {
      const mockFetch = createMockFetch(mockResponse("OK", { status: 200 }));

      await expect(
        safeFetch({
          url: "https://api.internal",
          userAgent: "TestBot/1.0",
          fetch: mockFetch,
          logger: silentLogger,
        }),
      ).rejects.toMatchObject({ code: "host_blocked" });
    });

    it("blocks .localhost domains", async () => {
      const mockFetch = createMockFetch(mockResponse("OK", { status: 200 }));

      await expect(
        safeFetch({
          url: "https://app.localhost",
          userAgent: "TestBot/1.0",
          fetch: mockFetch,
          logger: silentLogger,
        }),
      ).rejects.toMatchObject({ code: "host_blocked" });
    });
  });

  describe("private IP blocking", () => {
    it("blocks direct private IPv4 addresses", async () => {
      const mockFetch = createMockFetch(mockResponse("OK", { status: 200 }));

      await expect(
        safeFetch({
          url: "https://192.168.1.1",
          userAgent: "TestBot/1.0",
          fetch: mockFetch,
          logger: silentLogger,
        }),
      ).rejects.toMatchObject({ code: "private_ip" });

      await expect(
        safeFetch({
          url: "https://10.0.0.1",
          userAgent: "TestBot/1.0",
          fetch: mockFetch,
          logger: silentLogger,
        }),
      ).rejects.toMatchObject({ code: "private_ip" });

      await expect(
        safeFetch({
          url: "https://127.0.0.1",
          userAgent: "TestBot/1.0",
          fetch: mockFetch,
          logger: silentLogger,
        }),
      ).rejects.toMatchObject({ code: "private_ip" });
    });

    it("blocks hostnames that resolve to private IPs", async () => {
      mockResolveHostIps.mockResolvedValue([
        { address: "192.168.1.100", family: 4 },
      ]);
      const mockFetch = createMockFetch(mockResponse("OK", { status: 200 }));

      await expect(
        safeFetch({
          url: "https://evil.com",
          userAgent: "TestBot/1.0",
          fetch: mockFetch,
          logger: silentLogger,
        }),
      ).rejects.toMatchObject({ code: "private_ip" });
    });

    it("allows public IPs", async () => {
      mockResolveHostIps.mockResolvedValue([{ address: "8.8.8.8", family: 4 }]);
      const mockFetch = createMockFetch(mockResponse("OK", { status: 200 }));

      const result = await safeFetch({
        url: "https://8.8.8.8",
        userAgent: "TestBot/1.0",
        fetch: mockFetch,
        logger: silentLogger,
      });

      expect(result.ok).toBe(true);
    });
  });

  describe("host allowlist", () => {
    it("allows hosts in allowlist", async () => {
      const mockFetch = createMockFetch(mockResponse("OK", { status: 200 }));

      const result = await safeFetch({
        url: "https://allowed.com",
        userAgent: "TestBot/1.0",
        allowedHosts: ["allowed.com"],
        fetch: mockFetch,
        logger: silentLogger,
      });

      expect(result.ok).toBe(true);
    });

    it("blocks hosts not in allowlist", async () => {
      const mockFetch = createMockFetch(mockResponse("OK", { status: 200 }));

      await expect(
        safeFetch({
          url: "https://notallowed.com",
          userAgent: "TestBot/1.0",
          allowedHosts: ["allowed.com"],
          fetch: mockFetch,
          logger: silentLogger,
        }),
      ).rejects.toMatchObject({ code: "host_not_allowed" });
    });

    it("is case-insensitive", async () => {
      const mockFetch = createMockFetch(mockResponse("OK", { status: 200 }));

      const result = await safeFetch({
        url: "https://ALLOWED.COM",
        userAgent: "TestBot/1.0",
        allowedHosts: ["allowed.com"],
        fetch: mockFetch,
        logger: silentLogger,
      });

      expect(result.ok).toBe(true);
    });
  });

  describe("redirect handling", () => {
    it("follows redirects", async () => {
      let callCount = 0;
      const mockFetch = vi.fn(async () => {
        callCount++;
        if (callCount === 1) {
          return mockResponse("", {
            status: 302,
            headers: { Location: "https://example.com/final" },
          });
        }
        return mockResponse("Final content", { status: 200 });
      });

      const result = await safeFetch({
        url: "https://example.com/start",
        userAgent: "TestBot/1.0",
        fetch: mockFetch,
        logger: silentLogger,
      });

      expect(result.ok).toBe(true);
      expect(result.finalUrl).toBe("https://example.com/final");
      expect(result.buffer.toString()).toBe("Final content");
      expect(mockFetch).toHaveBeenCalledTimes(2);
    });

    it("respects maxRedirects limit", async () => {
      const mockFetch = vi.fn(async () =>
        mockResponse("", {
          status: 302,
          headers: { Location: "https://example.com/next" },
        }),
      );

      await expect(
        safeFetch({
          url: "https://example.com/start",
          userAgent: "TestBot/1.0",
          maxRedirects: 2,
          fetch: mockFetch,
          logger: silentLogger,
        }),
      ).rejects.toMatchObject({ code: "redirect_limit" });

      // Initial + 2 redirects = 3 calls
      expect(mockFetch).toHaveBeenCalledTimes(3);
    });

    it("throws on missing Location header", async () => {
      const mockFetch = createMockFetch(
        mockResponse("", { status: 302 }), // No Location header
      );

      await expect(
        safeFetch({
          url: "https://example.com",
          userAgent: "TestBot/1.0",
          fetch: mockFetch,
          logger: silentLogger,
        }),
      ).rejects.toMatchObject({ code: "invalid_response" });
    });

    it("validates redirect targets against allowlist", async () => {
      const mockFetch = vi.fn(async () =>
        mockResponse("", {
          status: 302,
          headers: { Location: "https://evil.com/steal" },
        }),
      );

      await expect(
        safeFetch({
          url: "https://allowed.com",
          userAgent: "TestBot/1.0",
          allowedHosts: ["allowed.com"],
          fetch: mockFetch,
          logger: silentLogger,
        }),
      ).rejects.toMatchObject({ code: "host_not_allowed" });
    });

    it("returns redirect response when returnOnDisallowedRedirect is true", async () => {
      const mockFetch = vi.fn(async () =>
        mockResponse("Redirect body", {
          status: 302,
          headers: { Location: "https://evil.com/steal" },
        }),
      );

      const result = await safeFetch({
        url: "https://allowed.com",
        userAgent: "TestBot/1.0",
        allowedHosts: ["allowed.com"],
        returnOnDisallowedRedirect: true,
        fetch: mockFetch,
        logger: silentLogger,
      });

      expect(result.status).toBe(302);
      expect(result.finalUrl).toBe("https://allowed.com/");
    });
  });

  describe("HEAD to GET fallback", () => {
    it("retries with GET when HEAD returns 405", async () => {
      const mockFetch = vi.fn(
        async (_input: RequestInfo | URL, init?: RequestInit) => {
          if (init?.method === "HEAD") {
            return mockResponse("", { status: 405 });
          }
          return mockResponse("GET content", { status: 200 });
        },
      );

      const result = await safeFetch({
        url: "https://example.com",
        userAgent: "TestBot/1.0",
        method: "HEAD",
        fallbackToGetOnHeadFailure: true,
        fetch: mockFetch,
        logger: silentLogger,
      });

      expect(result.ok).toBe(true);
      expect(result.buffer.toString()).toBe("GET content");
      expect(mockFetch).toHaveBeenCalledTimes(2);
      expect(mockFetch).toHaveBeenNthCalledWith(
        1,
        expect.any(String),
        expect.objectContaining({ method: "HEAD" }),
      );
      expect(mockFetch).toHaveBeenNthCalledWith(
        2,
        expect.any(String),
        expect.objectContaining({ method: "GET" }),
      );
    });

    it("does not retry without fallbackToGetOnHeadFailure", async () => {
      const mockFetch = createMockFetch(mockResponse("", { status: 405 }));

      const result = await safeFetch({
        url: "https://example.com",
        userAgent: "TestBot/1.0",
        method: "HEAD",
        fallbackToGetOnHeadFailure: false,
        fetch: mockFetch,
        logger: silentLogger,
      });

      expect(result.status).toBe(405);
      expect(mockFetch).toHaveBeenCalledTimes(1);
    });
  });

  describe("size limits", () => {
    it("rejects responses exceeding Content-Length", async () => {
      const mockFetch = createMockFetch(
        mockResponse("x".repeat(1000), {
          status: 200,
          headers: { "Content-Length": "1000" },
        }),
      );

      await expect(
        safeFetch({
          url: "https://example.com",
          userAgent: "TestBot/1.0",
          maxBytes: 500,
          fetch: mockFetch,
          logger: silentLogger,
        }),
      ).rejects.toMatchObject({ code: "size_exceeded" });
    });

    it("truncates response when truncateOnLimit is true", async () => {
      const mockFetch = createMockFetch(
        mockResponse("Hello, World!", { status: 200 }),
      );

      const result = await safeFetch({
        url: "https://example.com",
        userAgent: "TestBot/1.0",
        maxBytes: 5,
        truncateOnLimit: true,
        fetch: mockFetch,
        logger: silentLogger,
      });

      expect(result.buffer.toString()).toBe("Hello");
      expect(result.buffer.length).toBe(5);
    });

    it("allows Content-Length check to pass when truncateOnLimit is true", async () => {
      const mockFetch = createMockFetch(
        mockResponse("Hello, World!", {
          status: 200,
          headers: { "Content-Length": "13" },
        }),
      );

      const result = await safeFetch({
        url: "https://example.com",
        userAgent: "TestBot/1.0",
        maxBytes: 5,
        truncateOnLimit: true,
        fetch: mockFetch,
        logger: silentLogger,
      });

      // Should truncate instead of rejecting
      expect(result.buffer.length).toBe(5);
    });
  });

  describe("invalid URLs", () => {
    it("throws on invalid URL", async () => {
      const mockFetch = createMockFetch(mockResponse("OK", { status: 200 }));

      await expect(
        safeFetch({
          url: "not-a-valid-url",
          userAgent: "TestBot/1.0",
          fetch: mockFetch,
          logger: silentLogger,
        }),
      ).rejects.toMatchObject({ code: "invalid_url" });
    });
  });

  describe("DNS errors", () => {
    it("throws on DNS lookup failure", async () => {
      mockResolveHostIps.mockRejectedValue(new Error("DNS resolution failed"));
      const mockFetch = createMockFetch(mockResponse("OK", { status: 200 }));

      await expect(
        safeFetch({
          url: "https://nonexistent.invalid",
          userAgent: "TestBot/1.0",
          fetch: mockFetch,
          logger: silentLogger,
        }),
      ).rejects.toMatchObject({ code: "dns_error" });
    });

    it("throws when DNS returns no records", async () => {
      mockResolveHostIps.mockResolvedValue([]);
      const mockFetch = createMockFetch(mockResponse("OK", { status: 200 }));

      await expect(
        safeFetch({
          url: "https://empty.invalid",
          userAgent: "TestBot/1.0",
          fetch: mockFetch,
          logger: silentLogger,
        }),
      ).rejects.toMatchObject({ code: "dns_error" });
    });
  });

  describe("response headers", () => {
    it("includes all response headers", async () => {
      const mockFetch = createMockFetch(
        mockResponse("OK", {
          status: 200,
          headers: {
            "Content-Type": "text/plain",
            "X-Custom-Header": "custom-value",
            "Cache-Control": "no-cache",
          },
        }),
      );

      const result = await safeFetch({
        url: "https://example.com",
        userAgent: "TestBot/1.0",
        fetch: mockFetch,
        logger: silentLogger,
      });

      expect(result.headers["content-type"]).toBe("text/plain");
      expect(result.headers["x-custom-header"]).toBe("custom-value");
      expect(result.headers["cache-control"]).toBe("no-cache");
    });

    it("returns contentType from Content-Type header", async () => {
      const mockFetch = createMockFetch(
        mockResponse("OK", {
          status: 200,
          headers: { "Content-Type": "application/json; charset=utf-8" },
        }),
      );

      const result = await safeFetch({
        url: "https://example.com",
        userAgent: "TestBot/1.0",
        fetch: mockFetch,
        logger: silentLogger,
      });

      expect(result.contentType).toBe("application/json; charset=utf-8");
    });
  });
});

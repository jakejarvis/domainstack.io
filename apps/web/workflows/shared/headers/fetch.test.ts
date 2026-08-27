/* @vitest-environment node */
import { lookup } from "node:dns/promises";

import { HttpResponse, http } from "msw";
import { afterEach, describe, expect, it, vi } from "vitest";

import { server } from "@/mocks/server";

type MockDnsLookup = (hostname: string) => Promise<Array<{ address: string; family: 4 }>>;

vi.mock("node:dns/promises", () => ({
  lookup: vi.fn<MockDnsLookup>(async (hostname: string) => {
    if (hostname.endsWith(".test")) {
      return [{ address: "1.2.3.4", family: 4 }];
    }
    throw Object.assign(new Error(`getaddrinfo ENOTFOUND ${hostname}`), {
      code: "ENOTFOUND",
    });
  }),
}));

const mockLookup = vi.mocked(lookup);

// Mock DNS for domain resolution.
function mockDns(domain: string) {
  // Keep explicit domain setup for readability in individual tests.
  expect(domain.endsWith(".test")).toBe(true);
}

afterEach(() => {
  vi.restoreAllMocks();
  server.resetHandlers();
});

describe("fetchHeadersStep", () => {
  it("fetches headers successfully via HEAD request", async () => {
    mockDns("success.test");
    server.use(
      http.head(
        "https://success.test/",
        () =>
          new HttpResponse(null, {
            status: 200,
            headers: {
              server: "vercel",
              "x-vercel-id": "abc123",
            },
          }),
      ),
    );

    const { fetchHeadersStep } = await import("./fetch");
    const result = await fetchHeadersStep("success.test");

    expect(result.success).toBe(true);
    if (!result.success) {
      throw new Error("Expected fetchHeadersStep to succeed");
    }
    expect(result.data.headers.length).toBeGreaterThan(0);
    expect(result.data.status).toBe(200);
    expect(result.data.statusMessage).toBe("OK");
  });

  it("captures non-2xx responses correctly", async () => {
    mockDns("forbidden.test");
    server.use(
      http.head(
        "https://forbidden.test/",
        () =>
          new HttpResponse(null, {
            status: 403,
            headers: {
              server: "nginx",
              "x-frame-options": "DENY",
            },
          }),
      ),
    );

    const { fetchHeadersStep } = await import("./fetch");
    const result = await fetchHeadersStep("forbidden.test");

    expect(result.success).toBe(true);
    if (!result.success) {
      throw new Error("Expected fetchHeadersStep to succeed");
    }
    expect(result.data.status).toBe(403);
    expect(result.data.statusMessage).toBe("Forbidden");
  });

  it("returns dns_error when DNS lookup returns no A/AAAA records", async () => {
    mockLookup.mockResolvedValueOnce([] as unknown as Awaited<ReturnType<typeof lookup>>);

    const { fetchHeadersStep } = await import("./fetch");
    const result = await fetchHeadersStep("empty-a.test");

    expect(result).toEqual({ success: false, error: "dns_error" });
  });

  it("returns dns_error when A records are missing (ENODATA)", async () => {
    mockLookup.mockRejectedValueOnce(
      Object.assign(new Error("queryA ENODATA missing-a.test"), { code: "ENODATA" }),
    );

    const { fetchHeadersStep } = await import("./fetch");
    const result = await fetchHeadersStep("missing-a.test");

    expect(result).toEqual({ success: false, error: "dns_error" });
  });

  it("returns fetch_error on network error", async () => {
    mockDns("error.test");
    server.use(
      http.head("https://error.test/", () => HttpResponse.error()),
      http.get("https://error.test/", () => HttpResponse.error()),
    );

    const { fetchHeadersStep } = await import("./fetch");
    const result = await fetchHeadersStep("error.test");

    expect(result).toEqual({ success: false, error: "fetch_error" });
  });

  it("normalizes headers correctly", async () => {
    mockDns("normalized.test");
    server.use(
      http.head("https://normalized.test/", () => {
        return new HttpResponse(null, {
          status: 200,
          headers: {
            "X-Custom": "value",
            Server: "NGINX", // Mixed case
            "Content-Security-Policy": "default-src 'self'",
            Accept: "text/html",
          },
        });
      }),
    );

    const { fetchHeadersStep } = await import("./fetch");
    const result = await fetchHeadersStep("normalized.test");

    expect(result.success).toBe(true);
    if (!result.success) {
      throw new Error("Expected fetchHeadersStep to succeed");
    }
    // All headers should be lowercase
    const headerNames = result.data.headers.map((h) => h.name);
    expect(headerNames).toEqual(
      expect.arrayContaining(["server", "content-security-policy", "x-custom", "accept"]),
    );

    // All header names should be lowercase
    for (const name of headerNames) {
      expect(name).toBe(name.toLowerCase());
    }
  });
});

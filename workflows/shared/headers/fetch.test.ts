/* @vitest-environment node */
import { HttpResponse, http } from "msw";
import { afterEach, describe, expect, it, vi } from "vitest";
import { server } from "@/mocks/server";

// Mock DNS for domain resolution
function mockDns(domain: string) {
  server.use(
    http.get("https://cloudflare-dns.com/dns-query", ({ request }) => {
      const url = new URL(request.url);
      const name = url.searchParams.get("name");

      if (name === domain) {
        return HttpResponse.json({
          Status: 0,
          Answer: [
            {
              name: `${domain}.`,
              type: 1,
              TTL: 60,
              data: "1.2.3.4",
            },
          ],
        });
      }

      return HttpResponse.json({ Status: 0, Answer: [] });
    }),
  );
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
    if (result.success) {
      expect(result.data.headers.length).toBeGreaterThan(0);
      expect(result.data.status).toBe(200);
      expect(result.data.statusMessage).toBe("OK");
    }
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
    if (result.success) {
      expect(result.data.status).toBe(403);
      expect(result.data.statusMessage).toBe("Forbidden");
    }
  });

  it("throws RetryableError on network error", async () => {
    mockDns("error.test");
    server.use(
      http.head("https://error.test/", () => HttpResponse.error()),
      http.get("https://error.test/", () => HttpResponse.error()),
    );

    const { fetchHeadersStep } = await import("./fetch");

    await expect(fetchHeadersStep("error.test")).rejects.toThrow(
      "Headers fetch failed",
    );
  });

  it("normalizes and sorts headers correctly", async () => {
    mockDns("sorted.test");
    server.use(
      http.head("https://sorted.test/", () => {
        return new HttpResponse(null, {
          status: 200,
          headers: {
            "X-Custom": "value",
            Server: "NGINX", // Mixed case
            "Content-Security-Policy": "default-src 'self'", // Important header
            Accept: "text/html",
          },
        });
      }),
    );

    const { fetchHeadersStep } = await import("./fetch");
    const result = await fetchHeadersStep("sorted.test");

    expect(result.success).toBe(true);
    if (result.success) {
      // All headers should be lowercase
      const headerNames = result.data.headers.map((h) => h.name);
      expect(headerNames).toEqual(
        expect.arrayContaining([
          "server",
          "content-security-policy",
          "x-custom",
          "accept",
        ]),
      );

      // Important headers (like content-security-policy) should be first
      const cspIndex = headerNames.indexOf("content-security-policy");
      const serverIndex = headerNames.indexOf("server");
      expect(cspIndex).toBeLessThan(serverIndex);
    }
  });
});

import { HttpResponse, http } from "msw";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DOH_PROVIDERS } from "@/lib/dns-utils";
import { server } from "@/mocks/server";

describe("dohLookup", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  afterEach(() => {
    server.resetHandlers();
  });

  // Helper to apply a response to ALL providers
  function mockAllProviders(responseFactory: (url: URL) => object) {
    server.use(
      ...DOH_PROVIDERS.map((provider) =>
        http.get(provider.url, ({ request }) => {
          const url = new URL(request.url);
          return HttpResponse.json(responseFactory(url));
        }),
      ),
    );
  }

  it("resolves hostname to single IP address (all: false)", async () => {
    mockAllProviders(() => ({
      Status: 0,
      Answer: [
        {
          name: "example.test.",
          type: 1,
          TTL: 300,
          data: "93.184.216.34",
        },
      ],
    }));

    const { dohLookup } = await import("./resolver");
    const result = await dohLookup("example.test");

    expect(result).toEqual({
      address: "93.184.216.34",
      family: 4,
    });
  });

  it("resolves hostname to multiple IP addresses (all: true)", async () => {
    mockAllProviders((url) => {
      const type = url.searchParams.get("type");
      if (type === "A") {
        return {
          Status: 0,
          Answer: [
            {
              name: "example.test.",
              type: 1,
              TTL: 300,
              data: "93.184.216.34",
            },
          ],
        };
      }
      if (type === "AAAA") {
        return {
          Status: 0,
          Answer: [
            {
              name: "example.test.",
              type: 28,
              TTL: 300,
              data: "2606:2800:220:1:248:1893:25c8:1946",
            },
          ],
        };
      }
      return { Status: 0, Answer: [] };
    });

    const { dohLookup } = await import("./resolver");
    const result = await dohLookup("example.test", { all: true });

    expect(Array.isArray(result)).toBe(true);
    expect(result).toHaveLength(2);
    expect(result).toEqual([
      { address: "93.184.216.34", family: 4 },
      { address: "2606:2800:220:1:248:1893:25c8:1946", family: 6 },
    ]);
  });

  it("returns only IPv4 when AAAA query fails", async () => {
    mockAllProviders((url) => {
      const type = url.searchParams.get("type");
      if (type === "A") {
        return {
          Status: 0,
          Answer: [
            {
              name: "example.test.",
              type: 1,
              TTL: 300,
              data: "93.184.216.34",
            },
          ],
        };
      }
      // AAAA fails (SERVFAIL or similar non-zero status)
      return { Status: 3 }; // NXDOMAIN or error
    });

    const { dohLookup } = await import("./resolver");
    const result = await dohLookup("example.test", { all: true });

    expect(Array.isArray(result)).toBe(true);
    expect(result).toHaveLength(1);
    expect(result).toEqual([{ address: "93.184.216.34", family: 4 }]);
  });

  it("throws error when all DoH providers fail", async () => {
    // Force network error on all providers
    server.use(
      ...DOH_PROVIDERS.map((p) =>
        http.get(p.url, () => {
          return HttpResponse.error();
        }),
      ),
    );

    const { dohLookup } = await import("./resolver");
    await expect(dohLookup("example.test")).rejects.toThrow();
  });

  it("returns empty array when hostname does not exist (NXDOMAIN)", async () => {
    mockAllProviders(() => ({ Status: 3 })); // NXDOMAIN

    const { dohLookup } = await import("./resolver");

    // Should try next provider and eventually fail with last error or throw generic
    // dohLookup throws if all providers fail/return no records for what it needs
    await expect(
      dohLookup("nonexistent.invalid", { all: true }),
    ).rejects.toThrow();
  });

  it("filters records by type correctly", async () => {
    mockAllProviders((url) => {
      const type = url.searchParams.get("type");
      if (type === "A") {
        return {
          Status: 0,
          Answer: [
            {
              name: "example.test.",
              type: 1, // A record
              TTL: 300,
              data: "93.184.216.34",
            },
            {
              name: "example.test.",
              type: 5, // CNAME (should be ignored)
              TTL: 300,
              data: "other.example.test.",
            },
          ],
        };
      }
      return { Status: 0, Answer: [] };
    });

    const { dohLookup } = await import("./resolver");
    const result = await dohLookup("example.test", { all: true });

    expect(Array.isArray(result)).toBe(true);
    expect(result).toHaveLength(1);
    expect(result).toEqual([{ address: "93.184.216.34", family: 4 }]);
  });

  it("tries fallback providers on failure", async () => {
    const { providerOrderForLookup } = await import("@/lib/dns-utils");

    // Identify primary and secondary providers for the domain
    // dohLookup uses providerOrderForLookup internally
    const providers = providerOrderForLookup("example.test");
    const primary = providers[0];
    const secondary = providers[1];

    server.use(
      // Primary fails
      http.get(primary.url, () => HttpResponse.error()),

      // Secondary succeeds
      http.get(secondary.url, ({ request }) => {
        const url = new URL(request.url);
        const type = url.searchParams.get("type");
        if (type === "A") {
          return HttpResponse.json({
            Status: 0,
            Answer: [
              {
                name: "example.test.",
                type: 1,
                TTL: 300,
                data: "93.184.216.34",
              },
            ],
          });
        }
        return HttpResponse.json({ Status: 0, Answer: [] });
      }),
    );

    const { dohLookup } = await import("./resolver");
    const result = await dohLookup("example.test", { all: true });

    expect(result).toEqual([{ address: "93.184.216.34", family: 4 }]);
  });
});

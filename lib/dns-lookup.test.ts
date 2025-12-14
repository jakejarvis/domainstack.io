import { beforeEach, describe, expect, it, vi } from "vitest";

describe("dnsLookupViaHttps", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  it("resolves hostname to single IP address (all: false)", async () => {
    const fetchSpy = vi.spyOn(global, "fetch").mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          Status: 0,
          Answer: [
            {
              name: "example.com.",
              type: 1,
              TTL: 300,
              data: "93.184.216.34",
            },
          ],
        }),
        {
          status: 200,
          headers: { "Content-Type": "application/json" },
        },
      ),
    );

    const { dnsLookupViaHttps } = await import("./dns-lookup");
    const result = await dnsLookupViaHttps("example.com");

    expect(result).toEqual({
      address: "93.184.216.34",
      family: 4,
    });
    expect(fetchSpy).toHaveBeenCalled();
    fetchSpy.mockRestore();
  });

  it("resolves hostname to multiple IP addresses (all: true)", async () => {
    const fetchSpy = vi
      .spyOn(global, "fetch")
      // A record
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            Status: 0,
            Answer: [
              {
                name: "example.com.",
                type: 1,
                TTL: 300,
                data: "93.184.216.34",
              },
            ],
          }),
          {
            status: 200,
            headers: { "Content-Type": "application/json" },
          },
        ),
      )
      // AAAA record
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            Status: 0,
            Answer: [
              {
                name: "example.com.",
                type: 28,
                TTL: 300,
                data: "2606:2800:220:1:248:1893:25c8:1946",
              },
            ],
          }),
          {
            status: 200,
            headers: { "Content-Type": "application/json" },
          },
        ),
      );

    const { dnsLookupViaHttps } = await import("./dns-lookup");
    const result = await dnsLookupViaHttps("example.com", { all: true });

    expect(Array.isArray(result)).toBe(true);
    expect(result).toHaveLength(2);
    expect(result).toEqual([
      { address: "93.184.216.34", family: 4 },
      { address: "2606:2800:220:1:248:1893:25c8:1946", family: 6 },
    ]);

    fetchSpy.mockRestore();
  });

  it("returns only IPv4 when AAAA query fails", async () => {
    const fetchSpy = vi
      .spyOn(global, "fetch")
      // A record succeeds
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            Status: 0,
            Answer: [
              {
                name: "example.com.",
                type: 1,
                TTL: 300,
                data: "93.184.216.34",
              },
            ],
          }),
          {
            status: 200,
            headers: { "Content-Type": "application/json" },
          },
        ),
      )
      // AAAA record fails
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ Status: 3 }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
      );

    const { dnsLookupViaHttps } = await import("./dns-lookup");
    const result = await dnsLookupViaHttps("example.com", { all: true });

    expect(Array.isArray(result)).toBe(true);
    expect(result).toHaveLength(1);
    expect(result).toEqual([{ address: "93.184.216.34", family: 4 }]);

    fetchSpy.mockRestore();
  });

  it("throws error when all DoH providers fail", async () => {
    const fetchSpy = vi
      .spyOn(global, "fetch")
      .mockRejectedValue(new Error("Network error"));

    const { dnsLookupViaHttps } = await import("./dns-lookup");
    await expect(dnsLookupViaHttps("example.com")).rejects.toThrow();

    fetchSpy.mockRestore();
  });

  it("returns empty array when hostname does not exist (NXDOMAIN)", async () => {
    const fetchSpy = vi
      .spyOn(global, "fetch")
      // A record - NXDOMAIN
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ Status: 3 }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
      )
      // AAAA record - NXDOMAIN
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ Status: 3 }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
      );

    const { dnsLookupViaHttps } = await import("./dns-lookup");

    // Should try next provider and eventually fail
    await expect(
      dnsLookupViaHttps("nonexistent.invalid", { all: true }),
    ).rejects.toThrow();

    fetchSpy.mockRestore();
  });

  it("filters records by type correctly", async () => {
    const fetchSpy = vi
      .spyOn(global, "fetch")
      // A record with mixed types in response
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            Status: 0,
            Answer: [
              {
                name: "example.com.",
                type: 1, // A record
                TTL: 300,
                data: "93.184.216.34",
              },
              {
                name: "example.com.",
                type: 5, // CNAME (should be ignored)
                TTL: 300,
                data: "other.example.com.",
              },
            ],
          }),
          {
            status: 200,
            headers: { "Content-Type": "application/json" },
          },
        ),
      )
      // AAAA record
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            Status: 0,
            Answer: [],
          }),
          {
            status: 200,
            headers: { "Content-Type": "application/json" },
          },
        ),
      );

    const { dnsLookupViaHttps } = await import("./dns-lookup");
    const result = await dnsLookupViaHttps("example.com", { all: true });

    expect(Array.isArray(result)).toBe(true);
    expect(result).toHaveLength(1);
    expect(result).toEqual([{ address: "93.184.216.34", family: 4 }]);

    fetchSpy.mockRestore();
  });

  it("tries fallback providers on failure", async () => {
    const fetchSpy = vi
      .spyOn(global, "fetch")
      // First provider fails (A record)
      .mockRejectedValueOnce(new Error("Timeout"))
      // First provider fails (AAAA record)
      .mockRejectedValueOnce(new Error("Timeout"))
      // Second provider succeeds (A record)
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            Status: 0,
            Answer: [
              {
                name: "example.com.",
                type: 1,
                TTL: 300,
                data: "93.184.216.34",
              },
            ],
          }),
          {
            status: 200,
            headers: { "Content-Type": "application/json" },
          },
        ),
      )
      // Second provider succeeds (AAAA record)
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ Status: 3 }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
      );

    const { dnsLookupViaHttps } = await import("./dns-lookup");
    const result = await dnsLookupViaHttps("example.com", { all: true });

    expect(result).toEqual([{ address: "93.184.216.34", family: 4 }]);
    expect(fetchSpy).toHaveBeenCalledTimes(4); // 2 providers × 2 record types

    fetchSpy.mockRestore();
  });
});

/* @vitest-environment node */
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  safeFetch: vi.fn<(opts: { url: string; allowedHosts?: string[] }) => Promise<unknown>>(),
}));

vi.mock("@domainstack/safe-fetch", () => ({
  safeFetch: mocks.safeFetch,
  isExpectedDnsError: () => false,
}));

const { allowedRedirectHosts, fetchHttpHeaders } = await import("./fetch");

describe("allowedRedirectHosts", () => {
  it("allows an apex to follow its www redirect", () => {
    expect(allowedRedirectHosts("example.com")).toEqual(["example.com", "www.example.com"]);
  });

  it("keeps a www hostname to itself", () => {
    expect(allowedRedirectHosts("www.example.com")).toEqual(["www.example.com"]);
  });

  it("keys a subdomain to its exact hostname", () => {
    expect(allowedRedirectHosts("api.example.com")).toEqual([
      "api.example.com",
      "www.api.example.com",
    ]);
  });
});

describe("fetchHttpHeaders", () => {
  beforeEach(() => {
    mocks.safeFetch.mockReset();
    mocks.safeFetch.mockResolvedValue({
      status: 301,
      headers: { location: "https://example.com/" },
    });
  });

  it("stops at the www → apex redirect instead of reporting the apex", async () => {
    const result = await fetchHttpHeaders("www.example.com");

    expect(mocks.safeFetch).toHaveBeenCalledWith(
      expect.objectContaining({
        url: "https://www.example.com/",
        allowedHosts: ["www.example.com"],
        returnOnDisallowedRedirect: true,
      }),
    );
    expect(result).toEqual({
      success: true,
      data: {
        headers: [{ name: "location", value: "https://example.com/" }],
        status: 301,
        statusMessage: expect.any(String),
      },
    });
  });
});

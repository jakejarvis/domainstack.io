/* @vitest-environment node */
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  lookupSection: vi.fn<(...args: unknown[]) => Promise<unknown>>(),
}));

vi.mock("@domainstack/core/lookup", () => ({ lookupSection: mocks.lookupSection }));

import { RateLimitError } from "@domainstack/redis/enforce";

import { INVALID_DOMAIN_MESSAGE, RATE_LIMIT_MESSAGE } from "./domain-tools";
import { createDomainToolset } from "./tools";

const DNS_DATA = { records: [], resolver: "cloudflare" };

function runTool(
  name: keyof ReturnType<typeof createDomainToolset>,
  domain: string,
  ip: string | null = "1.2.3.4",
): Promise<unknown> {
  const tool = createDomainToolset()[name];
  return Promise.resolve(tool.execute?.({ domain }, { context: { ip } } as never));
}

describe("domain chat tools", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("looks up the tool's section for the normalized domain, metered by IP", async () => {
    mocks.lookupSection.mockResolvedValue({ success: true, cached: false, data: DNS_DATA });

    await expect(runTool("get_dns_records", "www.example.com")).resolves.toEqual(DNS_DATA);
    expect(mocks.lookupSection).toHaveBeenCalledWith("dns", "example.com", {
      identifier: "1.2.3.4",
    });
  });

  it("routes each tool to its own section", async () => {
    mocks.lookupSection.mockResolvedValue({ success: true, cached: true, data: {} });

    await runTool("get_registration", "example.com");
    await runTool("get_seo", "example.com");

    expect(mocks.lookupSection.mock.calls.map(([section]) => section)).toEqual([
      "registration",
      "seo",
    ]);
  });

  it("rejects an invalid domain without looking anything up", async () => {
    await expect(runTool("get_dns_records", "not a domain")).resolves.toEqual({
      error: INVALID_DOMAIN_MESSAGE,
    });
    expect(mocks.lookupSection).not.toHaveBeenCalled();
  });

  it("returns a readable message for a typed lookup failure", async () => {
    mocks.lookupSection.mockResolvedValue({ success: false, error: "dns_error" });

    await expect(runTool("get_headers", "example.com")).resolves.toEqual({
      error: expect.stringContaining("could not be resolved") as string,
    });
  });

  it("returns the rate-limit message instead of throwing", async () => {
    mocks.lookupSection.mockRejectedValue(
      new RateLimitError(30, { limit: 60, remaining: 0, reset: Date.now() + 30_000 }),
    );

    await expect(runTool("get_dns_records", "example.com")).resolves.toEqual({
      error: RATE_LIMIT_MESSAGE,
    });
  });

  it("throws a retryable error for unexpected failures", async () => {
    mocks.lookupSection.mockRejectedValue(new Error("db down"));

    await expect(runTool("get_dns_records", "example.com")).rejects.toThrow(
      "domain tool dns failed: db down",
    );
  });
});

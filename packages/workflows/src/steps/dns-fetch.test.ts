/* @vitest-environment node */
import { describe, expect, it, vi } from "vitest";
import { RetryableError } from "workflow";

import { RemoteDataUnavailableError } from "@domainstack/core/lib/fetch-errors";

const fetchDnsRecords = vi.hoisted(() => vi.fn<(domain: string) => Promise<never>>());
vi.mock("@domainstack/core/dns/fetch", () => ({ fetchDnsRecords }));

describe("fetchDnsRecordsStep", () => {
  it("retries with RetryableError when every DoH provider fails", async () => {
    fetchDnsRecords.mockRejectedValueOnce(new RemoteDataUnavailableError("DNS data unavailable"));

    const { fetchDnsRecordsStep } = await import("./dns");

    await expect(fetchDnsRecordsStep("x.test")).rejects.toBeInstanceOf(RetryableError);
  });

  it("lets other errors through unchanged", async () => {
    const bug = new TypeError("bug");
    fetchDnsRecords.mockRejectedValueOnce(bug);

    const { fetchDnsRecordsStep } = await import("./dns");

    await expect(fetchDnsRecordsStep("x.test")).rejects.toBe(bug);
  });
});

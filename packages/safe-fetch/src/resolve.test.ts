import type { lookup as dnsLookup } from "node:dns/promises";
import type { LookupFunction } from "node:net";

import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("node:dns/promises", () => ({
  lookup: vi.fn<typeof dnsLookup>(),
}));

import { lookup } from "node:dns/promises";

import { SafeFetchError } from "./errors";
import { createPinnedLookup, resolvePublicHost } from "./resolve";

const mockLookup = vi.mocked(lookup);
type LookupResult = Awaited<ReturnType<typeof lookup>>;

function mockLookupRecords(records: Array<{ address: string; family: 4 | 6 }>) {
  mockLookup.mockResolvedValue(records as unknown as LookupResult);
}

describe("resolvePublicHost", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockLookupRecords([{ address: "93.184.216.34", family: 4 }]);
  });

  it("returns validated public addresses", async () => {
    const addresses = await resolvePublicHost("example.com");
    expect(addresses).toEqual([{ address: "93.184.216.34", family: 4 }]);
  });

  it("rejects blocked hostnames without looking up DNS", async () => {
    await expect(resolvePublicHost("localhost")).rejects.toMatchObject({
      code: "host_blocked",
    } satisfies Partial<SafeFetchError>);
    expect(mockLookup).not.toHaveBeenCalled();
  });

  it("rejects blocked hostnames that include a trailing FQDN dot", async () => {
    await expect(resolvePublicHost("api.internal.")).rejects.toMatchObject({
      code: "host_blocked",
    } satisfies Partial<SafeFetchError>);
    await expect(resolvePublicHost("localhost.")).rejects.toMatchObject({
      code: "host_blocked",
    } satisfies Partial<SafeFetchError>);
    expect(mockLookup).not.toHaveBeenCalled();
  });

  it("rejects loopback IPs", async () => {
    await expect(resolvePublicHost("127.0.0.1")).rejects.toMatchObject({ code: "private_ip" });
    expect(mockLookup).not.toHaveBeenCalled();
  });

  it("rejects private DNS answers", async () => {
    mockLookupRecords([{ address: "10.1.2.3", family: 4 }]);
    await expect(resolvePublicHost("intranet.example")).rejects.toMatchObject({
      code: "private_ip",
    });
  });

  it("rejects mixed public and private DNS answers", async () => {
    mockLookupRecords([
      { address: "1.1.1.1", family: 4 },
      { address: "192.168.0.10", family: 4 },
    ]);
    await expect(resolvePublicHost("mixed.example")).rejects.toMatchObject({
      code: "private_ip",
    });
  });

  it("rejects reserved and link-local answers", async () => {
    mockLookupRecords([{ address: "169.254.1.1", family: 4 }]);
    await expect(resolvePublicHost("linklocal.example")).rejects.toMatchObject({
      code: "private_ip",
    });
  });
});

describe("createPinnedLookup", () => {
  it("returns the pinned addresses when all is requested", () => {
    const lookupFn = createPinnedLookup([
      { address: "1.1.1.1", family: 4 },
      { address: "2606:4700:4700::1111", family: 6 },
    ]);
    const callback = vi.fn<Parameters<LookupFunction>[2]>();
    lookupFn("example.com", { all: true }, callback);
    expect(callback).toHaveBeenCalledWith(null, [
      { address: "1.1.1.1", family: 4 },
      { address: "2606:4700:4700::1111", family: 6 },
    ]);
  });

  it("returns the first pinned address for single lookups", () => {
    const lookupFn = createPinnedLookup([{ address: "8.8.8.8", family: 4 }]);
    const callback = vi.fn<Parameters<LookupFunction>[2]>();
    lookupFn("example.com", { all: false }, callback);
    expect(callback).toHaveBeenCalledWith(null, "8.8.8.8", 4);
  });

  it("filters pinned addresses by requested family", () => {
    const lookupFn = createPinnedLookup([
      { address: "1.1.1.1", family: 4 },
      { address: "2606:4700:4700::1111", family: 6 },
    ]);
    const callback = vi.fn<Parameters<LookupFunction>[2]>();
    lookupFn("example.com", { all: true, family: 6 }, callback);
    expect(callback).toHaveBeenCalledWith(null, [{ address: "2606:4700:4700::1111", family: 6 }]);
  });

  it("returns ENOTFOUND when no pinned address matches the requested family", () => {
    const lookupFn = createPinnedLookup([{ address: "1.1.1.1", family: 4 }]);
    const callback = vi.fn<Parameters<LookupFunction>[2]>();
    lookupFn("example.com", { all: false, family: 6 }, callback);
    expect(callback).toHaveBeenCalledWith(expect.objectContaining({ code: "ENOTFOUND" }), "", 4);
  });
});

/* @vitest-environment node */
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  safeFetch: vi.fn<(opts: { url: string }) => Promise<unknown>>(),
  ensureDomainRecord: vi.fn<(domain: string) => Promise<{ id: string }>>(),
  upsertFavicon: vi.fn<(row: { url: string | null; notFound: boolean }) => Promise<void>>(),
}));

vi.mock("@domainstack/safe-fetch", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@domainstack/safe-fetch")>()),
  safeFetch: mocks.safeFetch,
}));
vi.mock("@domainstack/image", () => ({
  optimizeImage: vi.fn<() => Promise<Buffer>>(),
  storeImage: vi.fn<() => Promise<{ url: string }>>(),
}));
vi.mock("@domainstack/db/queries/domains", () => ({
  ensureDomainRecord: mocks.ensureDomainRecord,
}));
vi.mock("@domainstack/db/queries/favicons", () => ({ upsertFavicon: mocks.upsertFavicon }));

import { RemoteDataUnavailableError } from "../lib/fetch-errors";
import { fetchFavicon } from "./index";

function response(status: number, body = "") {
  return {
    ok: status >= 200 && status < 300,
    status,
    contentType: "image/x-icon",
    finalUrl: "https://example.com/favicon.ico",
    buffer: Buffer.from(body),
    headers: {},
  };
}

/** Answer every icon source with the given responses, in source order. */
function sourcesRespond(...responses: ReturnType<typeof response>[]) {
  let call = 0;
  mocks.safeFetch.mockImplementation(async () => responses[call++ % responses.length]);
}

describe("fetchFavicon when no source has an icon", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mocks.ensureDomainRecord.mockResolvedValue({ id: "domain-id" });
    mocks.upsertFavicon.mockResolvedValue(undefined);
  });

  it("treats an empty 200 like a 404: no icon here, cached as not found", async () => {
    sourcesRespond(response(200), response(200), response(404), response(200));

    await expect(fetchFavicon("example.com")).resolves.toEqual({
      success: true,
      data: { url: null },
    });
    expect(mocks.upsertFavicon).toHaveBeenCalledWith(
      expect.objectContaining({ url: null, notFound: true }),
    );
  });

  it("does not cache a negative result when any source failed transiently", async () => {
    sourcesRespond(response(200), response(404), response(503), response(200));

    await expect(fetchFavicon("example.com")).rejects.toBeInstanceOf(RemoteDataUnavailableError);
    expect(mocks.upsertFavicon).not.toHaveBeenCalled();
  });
});

/* @vitest-environment node */
import { beforeEach, describe, expect, it, vi } from "vitest";

import { SafeFetchError } from "@domainstack/safe-fetch";

const mocks = vi.hoisted(() => ({
  safeFetch: vi.fn<(opts: { url: string }) => Promise<unknown>>(),
  optimizeImage: vi.fn<(buffer: Buffer, opts: unknown) => Promise<Buffer>>(),
  storeImage: vi.fn<(opts: unknown) => Promise<{ url: string; pathname?: string }>>(),
  ensureDomainRecord: vi.fn<(domain: string) => Promise<{ id: string }>>(),
  upsertFavicon: vi.fn<(row: FaviconRow) => Promise<void>>(),
}));

interface FaviconRow {
  url: string | null;
  notFound: boolean;
  fetchedAt: Date;
  expiresAt: Date;
}

vi.mock("@domainstack/safe-fetch", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@domainstack/safe-fetch")>()),
  safeFetch: mocks.safeFetch,
}));
vi.mock("@domainstack/image", () => ({
  optimizeImage: mocks.optimizeImage,
  storeImage: mocks.storeImage,
}));
vi.mock("@domainstack/db/queries/domains", () => ({
  ensureDomainRecord: mocks.ensureDomainRecord,
}));
vi.mock("@domainstack/db/queries/favicons", () => ({ upsertFavicon: mocks.upsertFavicon }));

import { RemoteDataUnavailableError } from "../lib/fetch-errors";
import { fetchFavicon } from "./index";

const ONE_WEEK_MS = 7 * 24 * 60 * 60 * 1000;
const ICON_BYTES = "icon-bytes";

function response(status: number, body = "", contentType = "image/x-icon") {
  return {
    ok: status >= 200 && status < 300,
    status,
    contentType,
    finalUrl: "https://example.com/favicon.ico",
    buffer: Buffer.from(body),
    headers: {},
  };
}

/** Answer each icon source in order (google, duckduckgo, direct https, direct http). */
function sourcesRespond(...steps: Array<ReturnType<typeof response> | Error>) {
  let call = 0;
  mocks.safeFetch.mockImplementation(async () => {
    const step = steps[call++ % steps.length];
    if (step instanceof Error) throw step;
    return step;
  });
}

function persisted(): FaviconRow {
  expect(mocks.upsertFavicon).toHaveBeenCalledOnce();
  return mocks.upsertFavicon.mock.calls[0][0];
}

beforeEach(() => {
  vi.resetAllMocks();
  mocks.ensureDomainRecord.mockResolvedValue({ id: "domain-id" });
  mocks.upsertFavicon.mockResolvedValue(undefined);
  mocks.optimizeImage.mockResolvedValue(Buffer.from("optimized"));
  mocks.storeImage.mockResolvedValue({
    url: "https://blob.test/favicon.png",
    pathname: "favicons/example.com.png",
  });
});

describe("fetchFavicon when a source has an icon", () => {
  it("processes, stores, and persists the icon with its upstream metadata", async () => {
    sourcesRespond(response(200, ICON_BYTES, "image/png"));

    await expect(fetchFavicon("example.com")).resolves.toEqual({
      success: true,
      data: { url: "https://blob.test/favicon.png" },
    });

    expect(mocks.optimizeImage).toHaveBeenCalledWith(Buffer.from(ICON_BYTES), {
      width: 32,
      height: 32,
    });
    expect(mocks.storeImage).toHaveBeenCalledWith({
      kind: "favicon",
      domain: "example.com",
      buffer: Buffer.from("optimized"),
      width: 32,
      height: 32,
    });
    expect(mocks.upsertFavicon).toHaveBeenCalledWith(
      expect.objectContaining({
        domainId: "domain-id",
        url: "https://blob.test/favicon.png",
        pathname: "favicons/example.com.png",
        size: 32,
        source: "google",
        notFound: false,
        upstreamStatus: 200,
        upstreamContentType: "image/png",
      }),
    );
    const row = persisted();
    expect(row.expiresAt.getTime() - row.fetchedAt.getTime()).toBe(ONE_WEEK_MS);
    // The first source that answers wins; later sources are not tried
    expect(mocks.safeFetch).toHaveBeenCalledOnce();
  });

  it("falls through past sources without an icon and records which one supplied it", async () => {
    sourcesRespond(response(404), response(200, ICON_BYTES));

    await fetchFavicon("example.com");

    expect(mocks.upsertFavicon).toHaveBeenCalledWith(
      expect.objectContaining({ source: "duckduckgo", notFound: false }),
    );
    expect(mocks.safeFetch).toHaveBeenCalledTimes(2);
  });

  it("reports an image that optimizes to nothing instead of caching it", async () => {
    sourcesRespond(response(200, ICON_BYTES));
    mocks.optimizeImage.mockResolvedValue(Buffer.alloc(0));

    await expect(fetchFavicon("example.com")).rejects.toThrow("empty result");
    expect(mocks.upsertFavicon).not.toHaveBeenCalled();
  });
});

describe("fetchFavicon when no source has an icon", () => {
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

  it("caches not-found when every source is blocked or unreachable by policy", async () => {
    sourcesRespond(
      new SafeFetchError("host_blocked", "blocked"),
      new SafeFetchError("private_ip", "private"),
      response(404),
      new SafeFetchError("protocol_not_allowed", "no http"),
    );

    await expect(fetchFavicon("example.com")).resolves.toEqual({
      success: true,
      data: { url: null },
    });
    expect(persisted().notFound).toBe(true);
  });

  it("does not cache a negative result when a source failed transiently", async () => {
    sourcesRespond(response(200), response(404), response(503), response(200));

    await expect(fetchFavicon("example.com")).rejects.toBeInstanceOf(RemoteDataUnavailableError);
    expect(mocks.upsertFavicon).not.toHaveBeenCalled();
  });

  it("does not cache a negative result when a source timed out or errored", async () => {
    sourcesRespond(
      response(404),
      new SafeFetchError("timeout", "timed out"),
      response(404),
      response(404),
    );

    await expect(fetchFavicon("example.com")).rejects.toBeInstanceOf(RemoteDataUnavailableError);
    expect(mocks.upsertFavicon).not.toHaveBeenCalled();
  });
});

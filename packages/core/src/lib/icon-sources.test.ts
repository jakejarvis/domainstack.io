/* @vitest-environment node */
import { beforeEach, describe, expect, it, vi } from "vitest";

import { SafeFetchError } from "@domainstack/safe-fetch/errors";

const mocks = vi.hoisted(() => ({
  safeFetch: vi.fn<(opts: { url: string }) => Promise<unknown>>(),
  optimizeImage: vi.fn<(buffer: Buffer, opts: unknown) => Promise<Buffer>>(),
}));

vi.mock("@domainstack/safe-fetch", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@domainstack/safe-fetch")>()),
  safeFetch: mocks.safeFetch,
}));
vi.mock("@domainstack/image", () => ({
  optimizeImage: mocks.optimizeImage,
}));

import { fetchFirstIcon, type IconSource } from "./icon-sources";

const OPTIONS = { size: 48, maxBytes: 1234, timeoutMs: 567 };

const SOURCES: IconSource[] = [
  { url: "https://a.test/icon", name: "a" },
  { url: "https://b.test/icon", name: "b" },
  { url: "https://c.test/icon", name: "c" },
];

function response(status: number, body = "", contentType = "image/png") {
  return {
    ok: status >= 200 && status < 300,
    status,
    contentType,
    finalUrl: "https://example.com/icon",
    buffer: Buffer.from(body),
    headers: {},
  };
}

/** Answer each source in order; a call beyond the steps given fails the test. */
function sourcesRespond(...steps: Array<ReturnType<typeof response> | Error>) {
  let call = 0;
  mocks.safeFetch.mockImplementation(async ({ url }) => {
    const step = steps[call++];
    if (!step) throw new Error(`unexpected safeFetch call ${call}: ${url}`);
    if (step instanceof Error) throw step;
    return step;
  });
}

beforeEach(() => {
  vi.resetAllMocks();
  mocks.optimizeImage.mockResolvedValue(Buffer.from("optimized"));
});

describe("fetchFirstIcon", () => {
  it("returns the first decodable source and does not fetch later ones", async () => {
    sourcesRespond(response(200, "bytes", "image/webp"));

    await expect(fetchFirstIcon(SOURCES, OPTIONS)).resolves.toEqual({
      success: true,
      optimized: Buffer.from("optimized"),
      contentType: "image/webp",
      status: 200,
      sourceName: "a",
    });
    expect(mocks.safeFetch).toHaveBeenCalledOnce();
  });

  it("falls through a 404 to the next source", async () => {
    sourcesRespond(response(404), response(200, "bytes"));

    const result = await fetchFirstIcon(SOURCES, OPTIONS);

    expect(result).toMatchObject({ success: true, sourceName: "b" });
    expect(mocks.safeFetch).toHaveBeenCalledTimes(2);
  });

  it("reports allNotFound when every source is a 404 or 400", async () => {
    sourcesRespond(response(404), response(400), response(404));

    await expect(fetchFirstIcon(SOURCES, OPTIONS)).resolves.toEqual({
      success: false,
      allNotFound: true,
    });
  });

  it("clears allNotFound when a source fails with a retryable status", async () => {
    sourcesRespond(response(500), response(404), response(404));

    await expect(fetchFirstIcon(SOURCES, OPTIONS)).resolves.toEqual({
      success: false,
      allNotFound: false,
    });
  });

  it("treats a 200 that does not decode as an image as not found", async () => {
    mocks.optimizeImage.mockRejectedValueOnce(new Error("unsupported image format"));
    sourcesRespond(response(200, "<html>"), response(404), response(404));

    await expect(fetchFirstIcon(SOURCES, OPTIONS)).resolves.toEqual({
      success: false,
      allNotFound: true,
    });
  });

  it("distinguishes definitive thrown errors from transient ones", async () => {
    sourcesRespond(
      new SafeFetchError("private_ip", "blocked"),
      response(404),
      new SafeFetchError("private_ip", "blocked"),
    );
    await expect(fetchFirstIcon(SOURCES, OPTIONS)).resolves.toEqual({
      success: false,
      allNotFound: true,
    });

    sourcesRespond(new Error("socket hang up"), response(404), response(404));
    await expect(fetchFirstIcon(SOURCES, OPTIONS)).resolves.toEqual({
      success: false,
      allNotFound: false,
    });
  });

  it("passes size, maxBytes, and timeoutMs through to optimizeImage and safeFetch", async () => {
    sourcesRespond(response(200, "bytes"));

    await fetchFirstIcon(SOURCES, OPTIONS);

    expect(mocks.optimizeImage).toHaveBeenCalledWith(Buffer.from("bytes"), {
      width: 48,
      height: 48,
    });
    expect(mocks.safeFetch).toHaveBeenCalledWith(
      expect.objectContaining({ url: "https://a.test/icon", maxBytes: 1234, timeoutMs: 567 }),
    );
  });
});

/* @vitest-environment node */
import { afterEach, describe, expect, it, vi } from "vitest";
import type { DeleteResult } from "@/lib/blob";

const blobPutMock = vi.hoisted(() =>
  vi.fn(async (pathname: string) => ({
    url: `https://test-store.public.blob.vercel-storage.com/${pathname}`,
    downloadUrl: `https://test-store.public.blob.vercel-storage.com/${pathname}?download=1`,
    contentType: "image/webp",
  })),
);

const blobDelMock = vi.hoisted(() => vi.fn(async () => undefined));

vi.mock("@vercel/blob", () => ({
  put: blobPutMock,
  del: blobDelMock,
}));

const deleteBlobsMock = vi.hoisted(() =>
  vi.fn<(urls: string[]) => Promise<DeleteResult>>(async () => []),
);

vi.mock("@/lib/blob", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/blob")>();
  return {
    ...actual,
    deleteBlobs: deleteBlobsMock,
  };
});

vi.stubEnv("BLOB_READ_WRITE_TOKEN", "test-token");
vi.stubEnv("BLOB_SIGNING_SECRET", "secret");

import { storeImage } from "./storage";

afterEach(() => {
  vi.restoreAllMocks();
  blobPutMock.mockClear();
  blobDelMock.mockClear();
  deleteBlobsMock.mockClear();
});

describe("storage uploads", () => {
  it("storeImage (favicon) returns Vercel Blob public URL and pathname", async () => {
    const res = await storeImage({
      kind: "favicon",
      domain: "example.test",
      buffer: Buffer.from([1, 2, 3]),
      width: 32,
      height: 32,
    });
    expect(res.url).toMatch(
      /^https:\/\/.*\.blob\.vercel-storage\.com\/[a-f0-9]{32}\/32x32\./,
    );
    expect(res.pathname).toMatch(/^[a-f0-9]{32}\/32x32\./);
    expect(blobPutMock).toHaveBeenCalledTimes(1);
  });

  it("storeImage (screenshot) returns Vercel Blob public URL and pathname", async () => {
    const res = await storeImage({
      kind: "screenshot",
      domain: "example.test",
      buffer: Buffer.from([4, 5, 6]),
      width: 1200,
      height: 630,
    });
    expect(res.url).toMatch(
      /^https:\/\/.*\.blob\.vercel-storage\.com\/[a-f0-9]{32}\/1200x630\./,
    );
    expect(res.pathname).toMatch(/^[a-f0-9]{32}\/1200x630\./);
    expect(blobPutMock).toHaveBeenCalledTimes(1);
  });

  it("retries on upload failure and succeeds on second attempt", async () => {
    blobPutMock
      .mockRejectedValueOnce(new Error("Network error"))
      .mockResolvedValueOnce({
        url: "https://test-store.public.blob.vercel-storage.com/favicon/hash/32x32.webp",
        downloadUrl:
          "https://test-store.public.blob.vercel-storage.com/favicon/hash/32x32.webp?download=1",
        contentType: "image/webp",
      });

    const res = await storeImage({
      kind: "favicon",
      domain: "retry.test",
      buffer: Buffer.from([1, 2, 3]),
      width: 32,
      height: 32,
    });

    expect(res.url).toMatch(/^https:\/\/.*\.blob\.vercel-storage\.com\//);
    expect(res.pathname).toMatch(/^[a-f0-9]{32}\/32x32\./);
    expect(blobPutMock).toHaveBeenCalledTimes(2);
  });

  it("retries once on transient failure then succeeds", async () => {
    blobPutMock
      .mockRejectedValueOnce(new Error("Transient"))
      .mockResolvedValueOnce({
        url: "https://test-store.public.blob.vercel-storage.com/favicon/hash/32x32.webp",
        downloadUrl:
          "https://test-store.public.blob.vercel-storage.com/favicon/hash/32x32.webp?download=1",
        contentType: "image/webp",
      });

    const res = await storeImage({
      kind: "favicon",
      domain: "retry.test",
      buffer: Buffer.from([1, 2, 3]),
      width: 32,
      height: 32,
    });

    expect(res.url).toMatch(/^https:\/\/.*\.blob\.vercel-storage\.com\//);
    expect(res.pathname).toMatch(/^[a-f0-9]{32}\/32x32\./);
    expect(blobPutMock).toHaveBeenCalledTimes(2);
  });

  it("throws after exhausting all retry attempts", async () => {
    blobPutMock.mockRejectedValue(new Error("Persistent error"));

    await expect(
      storeImage({
        kind: "favicon",
        domain: "fail.test",
        buffer: Buffer.from([1, 2, 3]),
        width: 32,
        height: 32,
      }),
    ).rejects.toThrow(/Upload failed after 3 attempts/);

    expect(blobPutMock).toHaveBeenCalledTimes(3);
  });

  it("succeeds after initial failure", async () => {
    blobPutMock
      .mockRejectedValueOnce(new Error("Blob API error"))
      .mockResolvedValueOnce({
        url: "https://test-store.public.blob.vercel-storage.com/favicon/hash/32x32.webp",
        downloadUrl:
          "https://test-store.public.blob.vercel-storage.com/favicon/hash/32x32.webp?download=1",
        contentType: "image/webp",
      });

    const res = await storeImage({
      kind: "favicon",
      domain: "error.test",
      buffer: Buffer.from([1, 2, 3]),
      width: 32,
      height: 32,
    });

    expect(res.url).toMatch(/^https:\/\/.*\.blob\.vercel-storage\.com\//);
    expect(res.pathname).toMatch(/^[a-f0-9]{32}\/32x32\./);
    expect(blobPutMock).toHaveBeenCalledTimes(2);
  });
});

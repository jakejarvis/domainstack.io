import { afterEach, describe, expect, it, vi } from "vitest";

import { blobKey, getFiles } from "./files";

const adapter = vi.hoisted(() => ({ upload: undefined as unknown as ReturnType<typeof vi.fn> }));

vi.mock("files-sdk/vercel-blob", async () => {
  const { memory } = await import("files-sdk/memory");
  return {
    vercelBlob: () => {
      const store = memory();
      adapter.upload = vi.spyOn(store, "upload");
      return store;
    },
  };
});

// 1x1 lossless WebP
const WEBP = Buffer.from("UklGRhoAAABXRUJQVlA4TA0AAAAvAAAAEAcQERGIiP4HAA==", "base64");

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("blobKey", () => {
  it("matches keys generated before the files-sdk migration", () => {
    vi.stubEnv("BLOB_SIGNING_SECRET", "test-secret");

    expect(blobKey("favicon", ["example.com", "favicon", "32x32"], "32x32.webp")).toBe(
      "46cd1efaa5cfa14e9c43342ee263d2b0/32x32.webp",
    );
  });

  it("throws when BLOB_SIGNING_SECRET is unset outside development", () => {
    vi.stubEnv("BLOB_SIGNING_SECRET", "");
    vi.stubEnv("NODE_ENV", "production");

    expect(() => blobKey("favicon", ["example.com"], "32x32.webp")).toThrow(
      "BLOB_SIGNING_SECRET is not set",
    );
  });

  it("falls back to a dev secret in development", () => {
    vi.stubEnv("BLOB_SIGNING_SECRET", "");
    vi.stubEnv("NODE_ENV", "development");

    expect(blobKey("favicon", ["example.com"], "32x32.webp")).toMatch(
      /^[0-9a-f]{32}\/32x32\.webp$/,
    );
  });
});

describe("getFiles", () => {
  it("returns a single shared instance", () => {
    expect(getFiles()).toBe(getFiles());
  });

  it("leaves the content type to the key's extension when the bytes agree", async () => {
    await getFiles().upload("abc/32x32.webp", WEBP);

    // Vercel Blob derives image/webp from the pathname when no type is sent
    expect(adapter.upload).toHaveBeenLastCalledWith(
      "abc/32x32.webp",
      WEBP,
      expect.not.objectContaining({ contentType: expect.anything() }),
    );
  });

  it("corrects the content type from the bytes when the extension disagrees", async () => {
    const files = getFiles();
    await files.upload("abc/32x32.png", WEBP);

    expect(adapter.upload).toHaveBeenLastCalledWith(
      "abc/32x32.png",
      WEBP,
      expect.objectContaining({ contentType: "image/webp" }),
    );
    expect((await files.head("abc/32x32.png")).type).toBe("image/webp");
  });
});

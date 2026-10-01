import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

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

  it("keeps the content type implied by the key's extension when the bytes agree", async () => {
    await getFiles().upload("abc/32x32.webp", WEBP);

    expect(adapter.upload).toHaveBeenLastCalledWith(
      "abc/32x32.webp",
      WEBP,
      expect.objectContaining({ contentType: "image/webp" }),
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

describe("getFiles in development without credentials", () => {
  async function importFresh() {
    vi.resetModules();
    return await import("./files");
  }

  it("stores files on disk and serves them from the dev server", async () => {
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("BLOB_READ_WRITE_TOKEN", "");
    vi.stubEnv("VERCEL_OIDC_TOKEN", "");
    vi.stubEnv("NEXT_PUBLIC_BASE_URL", "http://localhost:3000/");
    const cwd = await mkdtemp(path.join(tmpdir(), "blob-dev-"));
    const cwdSpy = vi.spyOn(process, "cwd").mockReturnValue(cwd);

    try {
      const { getFiles: getDevFiles } = await importFresh();
      await getDevFiles().upload("abc/32x32.webp", WEBP);

      expect(await readFile(path.join(cwd, "public", "_dev-blob", "abc", "32x32.webp"))).toEqual(
        WEBP,
      );
      expect(await getDevFiles().url("abc/32x32.webp")).toBe(
        "http://localhost:3000/_dev-blob/abc/32x32.webp",
      );
    } finally {
      cwdSpy.mockRestore();
      await rm(cwd, { recursive: true, force: true });
    }
  });

  it("uses Vercel Blob when a token is set", async () => {
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("BLOB_READ_WRITE_TOKEN", "vercel_blob_rw_test");

    adapter.upload.mockClear();

    const { getFiles: getDevFiles } = await importFresh();
    await getDevFiles().upload("abc/32x32.webp", WEBP);

    expect(adapter.upload).toHaveBeenCalledOnce();
  });
});

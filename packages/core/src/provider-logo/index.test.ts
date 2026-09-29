/* @vitest-environment node */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  safeFetch: vi.fn<(opts: { url: string }) => Promise<unknown>>(),
  optimizeImage: vi.fn<(buffer: Buffer, opts: unknown) => Promise<Buffer>>(),
  storeImage: vi.fn<(opts: unknown) => Promise<{ url: string; pathname?: string }>>(),
  upsertProviderLogo: vi.fn<(row: ProviderLogoRow) => Promise<void>>(),
}));

interface ProviderLogoRow {
  providerId: string;
  url: string | null;
  source: string | null;
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
vi.mock("@domainstack/db/queries/provider-logos", () => ({
  upsertProviderLogo: mocks.upsertProviderLogo,
}));

import { RemoteDataUnavailableError } from "../lib/fetch-errors";
import { fetchProviderLogo } from "./index";

const ICON_BYTES = "icon-bytes";

function response(status: number, body = "", contentType = "image/png") {
  return {
    ok: status >= 200 && status < 300,
    status,
    contentType,
    finalUrl: "https://example.com/favicon.ico",
    buffer: Buffer.from(body),
    headers: {},
  };
}

let unexpectedCalls: string[] = [];

/**
 * Answer each icon source in order (google, duckduckgo, direct https, direct
 * http; logo.dev is disabled). A call beyond the steps given is recorded and
 * fails the test, so an extra fetch can't silently reuse an earlier response.
 */
function sourcesRespond(...steps: Array<ReturnType<typeof response> | Error>) {
  let call = 0;
  mocks.safeFetch.mockImplementation(async ({ url }) => {
    const step = steps[call++];
    if (!step) {
      unexpectedCalls.push(url);
      throw new Error(`unexpected safeFetch call ${call}: ${url}`);
    }
    if (step instanceof Error) throw step;
    return step;
  });
}

function persisted(): ProviderLogoRow {
  expect(mocks.upsertProviderLogo).toHaveBeenCalledOnce();
  return mocks.upsertProviderLogo.mock.calls[0][0];
}

afterEach(({ task }) => {
  // The fetch loop swallows errors, so surface an extra call here instead. Skip
  // it when the test already failed, so the real failure isn't muddied.
  if (task.result?.errors?.length) return;
  if (unexpectedCalls.length > 0) {
    throw new Error(`unexpected safeFetch calls: ${unexpectedCalls.join(", ")}`);
  }
});

beforeEach(() => {
  unexpectedCalls = [];
  vi.resetAllMocks();
  vi.stubEnv("LOGO_DEV_PUBLISHABLE_KEY", "");
  mocks.upsertProviderLogo.mockResolvedValue(undefined);
  mocks.optimizeImage.mockResolvedValue(Buffer.from("optimized"));
  mocks.storeImage.mockResolvedValue({
    url: "https://blob.test/logo.png",
    pathname: "provider-logos/example.com.png",
  });
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("fetchProviderLogo", () => {
  it("processes, stores, and persists the logo from the first source with an image", async () => {
    sourcesRespond(response(200, ICON_BYTES));

    await expect(fetchProviderLogo("provider-id", "example.com")).resolves.toEqual({
      success: true,
      data: { url: "https://blob.test/logo.png" },
    });

    expect(mocks.optimizeImage).toHaveBeenCalledWith(Buffer.from(ICON_BYTES), {
      width: 64,
      height: 64,
    });
    expect(mocks.storeImage).toHaveBeenCalledWith({
      kind: "provider-logo",
      domain: "example.com",
      buffer: Buffer.from("optimized"),
      width: 64,
      height: 64,
    });
    expect(persisted()).toEqual(
      expect.objectContaining({
        providerId: "provider-id",
        url: "https://blob.test/logo.png",
        source: "google",
        notFound: false,
      }),
    );
    expect(mocks.safeFetch).toHaveBeenCalledOnce();
  });

  it("treats an empty 200 like a 404: no logo here, cached as not found", async () => {
    sourcesRespond(response(200), response(200), response(404), response(200));

    await expect(fetchProviderLogo("provider-id", "example.com")).resolves.toEqual({
      success: true,
      data: { url: null },
    });
    expect(persisted().notFound).toBe(true);
    expect(mocks.optimizeImage).not.toHaveBeenCalled();
  });

  it("falls through past a 200 that is not a decodable image", async () => {
    sourcesRespond(
      response(404),
      response(200, "<html>app shell</html>", "text/html"),
      response(200, ICON_BYTES),
    );
    mocks.optimizeImage.mockRejectedValueOnce(new Error("unsupported image format"));

    await expect(fetchProviderLogo("provider-id", "example.com")).resolves.toEqual({
      success: true,
      data: { url: "https://blob.test/logo.png" },
    });

    expect(persisted()).toEqual(
      expect.objectContaining({ source: "direct_https", notFound: false }),
    );
    expect(mocks.safeFetch).toHaveBeenCalledTimes(3);
  });

  it("does not cache a negative result when a source failed transiently", async () => {
    sourcesRespond(response(404), response(503), response(404), response(404));

    await expect(fetchProviderLogo("provider-id", "example.com")).rejects.toBeInstanceOf(
      RemoteDataUnavailableError,
    );
    expect(mocks.upsertProviderLogo).not.toHaveBeenCalled();
  });
});

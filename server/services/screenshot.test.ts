/* @vitest-environment node */
import {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";

const storageMock = vi.hoisted(() => ({
  storeImage: vi.fn(async () => ({
    url: "https://test-store.public.blob.vercel-storage.com/abcdef0123456789abcdef0123456789/1200x630.webp",
    pathname: "abcdef0123456789abcdef0123456789/1200x630.webp",
  })),
}));

vi.mock("@/lib/storage", () => storageMock);
vi.stubEnv("BLOB_READ_WRITE_TOKEN", "test-token");

// Mock puppeteer environments
const pageMock = {
  setViewport: vi.fn(async () => undefined),
  setUserAgent: vi.fn(async () => undefined),
  goto: vi.fn(async () => undefined),
  waitForNetworkIdle: vi.fn(async () => undefined),
  screenshot: vi.fn(async () => Buffer.from([1, 2, 3])),
  close: vi.fn(async () => undefined),
};
const browserMock = {
  newPage: vi.fn(async () => pageMock),
  close: vi.fn(async () => undefined),
};

vi.mock("@sparticuz/chromium", () => ({
  default: {
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
    executablePath: vi.fn(async () => "/usr/bin/chromium"),
  },
}));
vi.mock("puppeteer-core", () => ({
  launch: vi.fn(async () => browserMock),
}));

// Watermark function does a simple pass-through for test speed
vi.mock("@/lib/image", () => ({
  optimizeImageCover: vi.fn(async (b: Buffer) => b),
  addWatermarkToScreenshot: vi.fn(async (b: Buffer) => b),
}));

let getOrCreateScreenshotBlobUrl: typeof import("./screenshot").getOrCreateScreenshotBlobUrl;

beforeAll(async () => {
  const { makePGliteDb } = await import("@/lib/db/pglite");
  const { db } = await makePGliteDb();
  vi.doMock("@/lib/db/client", () => ({ db }));
  ({ getOrCreateScreenshotBlobUrl } = await import("./screenshot"));
});

beforeEach(() => {
  process.env.VERCEL = "1"; // force sparticuz + puppeteer-core path in tests
});

afterEach(async () => {
  vi.restoreAllMocks();
  storageMock.storeImage.mockReset();
  const { resetPGliteDb } = await import("@/lib/db/pglite");
  await resetPGliteDb();
  pageMock.goto.mockReset();
  pageMock.waitForNetworkIdle.mockReset();
  pageMock.screenshot.mockReset();
  pageMock.close.mockReset();
  browserMock.newPage.mockReset();
});

afterAll(async () => {
  // Close PGlite client to prevent file handle leaks
  const { closePGliteDb } = await import("@/lib/db/pglite");
  await closePGliteDb();
});

describe("getOrCreateScreenshotBlobUrl", () => {
  it("returns existing blob url from DB when present", async () => {
    const { ensureDomainRecord } = await import("@/lib/db/repos/domains");
    const { upsertScreenshot } = await import("@/lib/db/repos/screenshots");

    const domainRecord = await ensureDomainRecord("example.com");
    await upsertScreenshot({
      domainId: domainRecord.id,
      url: "blob://existing",
      pathname: null,
      width: 1200,
      height: 630,
      source: null,
      notFound: false,
      fetchedAt: new Date(),
      expiresAt: new Date(Date.now() + 1000000),
    });

    const out = await getOrCreateScreenshotBlobUrl("example.com");
    expect(out.url).toBe("blob://existing");
    expect(storageMock.storeImage).not.toHaveBeenCalled();
  });

  it("captures, uploads and returns url when not cached", async () => {
    const out = await getOrCreateScreenshotBlobUrl("example.com");
    expect(out.url).toMatch(
      /^https:\/\/.*\.blob\.vercel-storage\.com\/[a-f0-9]{32}\/1200x630\.webp$/,
    );
    expect(storageMock.storeImage).toHaveBeenCalled();
  }, 10000); // 10s timeout for browser operations

  it("retries navigation failure and succeeds on second attempt", async () => {
    let calls = 0;
    pageMock.goto.mockImplementation(async () => {
      calls += 1;
      if (calls === 1) throw new Error("nav failed");
    });
    const originalRandom = Math.random;
    Math.random = () => 0; // no jitter for determinism
    const out = await getOrCreateScreenshotBlobUrl("example.com", {
      attempts: 2,
      backoffBaseMs: 1,
      backoffMaxMs: 2,
    });
    Math.random = originalRandom;
    expect(out.url).toMatch(
      /^https:\/\/.*\.blob\.vercel-storage\.com\/[a-f0-9]{32}\/1200x630\.webp$/,
    );
    expect(pageMock.goto).toHaveBeenCalledTimes(2);
  }, 10000); // 10s timeout for retry logic

  it("retries screenshot failure and succeeds on second attempt", async () => {
    pageMock.goto.mockResolvedValueOnce(undefined);
    let shot = 0;
    pageMock.screenshot.mockImplementation(async () => {
      shot += 1;
      if (shot === 1) throw new Error("screenshot failed");
      return Buffer.from([1, 2, 3]);
    });
    const originalRandom = Math.random;
    Math.random = () => 0;
    const out = await getOrCreateScreenshotBlobUrl("example.com", {
      attempts: 2,
      backoffBaseMs: 1,
      backoffMaxMs: 2,
    });
    Math.random = originalRandom;
    expect(out.url).toMatch(
      /^https:\/\/.*\.blob\.vercel-storage\.com\/[a-f0-9]{32}\/1200x630\.webp$/,
    );
    expect(pageMock.screenshot).toHaveBeenCalledTimes(2);
  }, 10000); // 10s timeout for retry logic

  it("returns null when all attempts across both urls fail", async () => {
    pageMock.goto.mockImplementation(async () => {
      throw new Error("always fail");
    });
    const originalRandom = Math.random;
    Math.random = () => 0;
    const out = await getOrCreateScreenshotBlobUrl("example.com", {
      attempts: 2,
      backoffBaseMs: 1,
      backoffMaxMs: 2,
    });
    Math.random = originalRandom;
    expect(out.url).toBeNull();
    expect(pageMock.goto.mock.calls.length).toBeGreaterThanOrEqual(4);
  }, 15000); // 15s timeout for multiple retry attempts

  it("closes page on every retry attempt even when errors occur", async () => {
    let calls = 0;
    pageMock.goto.mockImplementation(async () => {
      calls += 1;
      throw new Error(`attempt ${calls} failed`);
    });
    const originalRandom = Math.random;
    Math.random = () => 0;
    const out = await getOrCreateScreenshotBlobUrl("example.com", {
      attempts: 3,
      backoffBaseMs: 1,
      backoffMaxMs: 2,
    });
    Math.random = originalRandom;
    expect(out.url).toBeNull();
    // Should have created pages for 3 attempts × 2 urls = 6 pages
    expect(browserMock.newPage).toHaveBeenCalledTimes(6);
    // Should have closed all 6 pages (no leaks)
    expect(pageMock.close).toHaveBeenCalledTimes(6);
  }, 15000); // 15s timeout for multiple retry attempts
});

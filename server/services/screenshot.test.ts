/* @vitest-environment node */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const blobMock = vi.hoisted(() => ({
  headScreenshotBlob: vi.fn(),
  putScreenshotBlob: vi.fn(async () => "blob://stored-screenshot"),
}));

vi.mock("@/lib/blob", () => blobMock);

// Mock puppeteer environments
const pageMock = {
  setViewport: vi.fn(async () => undefined),
  setUserAgent: vi.fn(async () => undefined),
  goto: vi.fn(async () => undefined),
  screenshot: vi.fn(async () => Buffer.from([1, 2, 3])),
};
const browserMock = {
  newPage: vi.fn(async () => pageMock),
  close: vi.fn(async () => undefined),
};

vi.mock("puppeteer", () => ({
  launch: vi.fn(async () => browserMock),
}));
vi.mock("puppeteer-core", () => ({
  launch: vi.fn(async () => browserMock),
}));

// Watermark function does a simple pass-through for test speed
vi.mock("@/lib/image", () => ({
  optimizePngCover: vi.fn(async (b: Buffer) => b),
  addWatermarkToScreenshot: vi.fn(async (b: Buffer) => b),
}));

import { getOrCreateScreenshotBlobUrl } from "./screenshot";

beforeEach(() => {
  process.env.VERCEL_ENV = ""; // force local puppeteer path in tests
});

afterEach(() => {
  vi.restoreAllMocks();
  blobMock.headScreenshotBlob.mockReset();
  blobMock.putScreenshotBlob.mockReset();
  pageMock.goto.mockReset();
  pageMock.screenshot.mockReset();
});

describe("getOrCreateScreenshotBlobUrl", () => {
  it("returns existing blob url when present", async () => {
    blobMock.headScreenshotBlob.mockResolvedValueOnce("blob://existing");
    const out = await getOrCreateScreenshotBlobUrl("example.com");
    expect(out.url).toBe("blob://existing");
    expect(blobMock.putScreenshotBlob).not.toHaveBeenCalled();
  });

  it("captures, uploads and returns url when not cached", async () => {
    blobMock.headScreenshotBlob.mockResolvedValueOnce(null);
    const out = await getOrCreateScreenshotBlobUrl("example.com");
    expect(out.url).toBe("blob://stored-screenshot");
    expect(blobMock.putScreenshotBlob).toHaveBeenCalled();
  });

  it("retries navigation failure and succeeds on second attempt", async () => {
    blobMock.headScreenshotBlob.mockResolvedValueOnce(null);
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
    expect(out.url).toBe("blob://stored-screenshot");
    expect(pageMock.goto).toHaveBeenCalledTimes(2);
  });

  it("retries screenshot failure and succeeds on second attempt", async () => {
    blobMock.headScreenshotBlob.mockResolvedValueOnce(null);
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
    expect(out.url).toBe("blob://stored-screenshot");
    expect(pageMock.screenshot).toHaveBeenCalledTimes(2);
  });

  it("returns null when all attempts across both urls fail", async () => {
    blobMock.headScreenshotBlob.mockResolvedValueOnce(null);
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
  });
});

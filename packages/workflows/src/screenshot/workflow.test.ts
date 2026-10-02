/* @vitest-environment node */
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { FatalError, RetryableError } from "workflow";

import { ScreenshotError, type ScreenshotErrorCode } from "@domainstack/screenshot";

// Hoist mocks for the dependencies the workflow's steps pull in via dynamic import.
const workflowMock = vi.hoisted(() => ({
  getStepMetadata: vi.fn<typeof import("workflow").getStepMetadata>(),
  createHook: vi.fn<typeof import("workflow").createHook>(),
}));

const screenshotMock = vi.hoisted(() => ({
  captureScreenshot: vi.fn<typeof import("@domainstack/screenshot").captureScreenshot>(),
}));

const blockedDomainsMock = vi.hoisted(() => ({
  isDomainBlocked:
    vi.fn<typeof import("@domainstack/db/queries/blocked-domains").isDomainBlocked>(),
}));

const domainsMock = vi.hoisted(() => ({
  ensureDomainRecord: vi.fn<typeof import("@domainstack/db/queries/domains").ensureDomainRecord>(),
}));

const screenshotsMock = vi.hoisted(() => ({
  upsertScreenshot: vi.fn<typeof import("@domainstack/db/queries/screenshots").upsertScreenshot>(),
}));

const imageMock = vi.hoisted(() => ({
  storeImage: vi.fn<typeof import("@domainstack/image").storeImage>(),
}));

vi.mock("workflow", async (importOriginal) => ({
  ...(await importOriginal<typeof import("workflow")>()),
  getStepMetadata: workflowMock.getStepMetadata,
  createHook: workflowMock.createHook,
}));
// Keep the real ScreenshotError and classifier, so the workflow acts on real classes.
vi.mock("@domainstack/screenshot", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@domainstack/screenshot")>()),
  captureScreenshot: screenshotMock.captureScreenshot,
}));
vi.mock("@domainstack/db/queries/blocked-domains", () => blockedDomainsMock);
vi.mock("@domainstack/db/queries/domains", () => domainsMock);
vi.mock("@domainstack/db/queries/screenshots", () => screenshotsMock);
vi.mock("@domainstack/image", () => imageMock);

let screenshotWorkflow: typeof import("./workflow").screenshotWorkflow;

// Load the module (and its SDK / sandbox / schema imports) under the hook
// timeout instead of inside the first test's budget.
beforeAll(async () => {
  ({ screenshotWorkflow } = await import("./workflow"));
});

const input = { domain: "example.com", domainId: "d1" };

const MISS = { success: false, error: "capture_error", data: { url: null } };

function failCapture(code: ScreenshotErrorCode) {
  screenshotMock.captureScreenshot.mockRejectedValue(new ScreenshotError(code, `failed: ${code}`));
}

function setAttempt(attempt: number) {
  workflowMock.getStepMetadata.mockReturnValue({ attempt } as never);
}

describe("screenshotWorkflow", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    setAttempt(1);
    workflowMock.createHook.mockImplementation(
      () => ({ getConflict: async () => null, [Symbol.dispose]() {} }) as never,
    );
    blockedDomainsMock.isDomainBlocked.mockResolvedValue(false);
    domainsMock.ensureDomainRecord.mockResolvedValue({ id: "d1" } as never);
    screenshotsMock.upsertScreenshot.mockResolvedValue(null);
    imageMock.storeImage.mockResolvedValue({ url: "https://blob/x.webp", pathname: "x.webp" });
    screenshotMock.captureScreenshot.mockResolvedValue({
      buffer: Buffer.from("webp"),
      width: 1200,
      height: 630,
      sandboxId: "sbx_1",
      durationMs: 10,
    });
  });

  it("stores and persists a successful capture", async () => {
    const result = await screenshotWorkflow(input);

    expect(imageMock.storeImage).toHaveBeenCalledWith(
      expect.objectContaining({ kind: "screenshot", domain: "example.com" }),
    );
    expect(screenshotsMock.upsertScreenshot).toHaveBeenCalledWith(
      expect.objectContaining({ notFound: false, url: "https://blob/x.webp" }),
    );
    expect(result).toEqual({ success: true, data: { url: "https://blob/x.webp", blocked: false } });
  });

  it("caches a permanent target failure as a miss", async () => {
    failCapture("tls_error");

    const result = await screenshotWorkflow(input);

    expect(screenshotsMock.upsertScreenshot).toHaveBeenCalledWith(
      expect.objectContaining({ notFound: true, url: null }),
    );
    expect(result).toEqual(MISS);
    expect(imageMock.storeImage).not.toHaveBeenCalled();
  });

  it("skips quietly, without caching, when no runner image is configured", async () => {
    failCapture("not_configured");

    const result = await screenshotWorkflow(input);

    expect(screenshotsMock.upsertScreenshot).not.toHaveBeenCalled();
    expect(imageMock.storeImage).not.toHaveBeenCalled();
    expect(result).toEqual(MISS);
  });

  it("fails fatally, without caching, on a configuration error", async () => {
    failCapture("configuration_error");

    await expect(screenshotWorkflow(input)).rejects.toBeInstanceOf(FatalError);

    expect(screenshotsMock.upsertScreenshot).not.toHaveBeenCalled();
  });

  it("retries a transient target failure until the final attempt", async () => {
    failCapture("upstream_temporary");

    // Attempt 2 is the last one that still retries: the boundary is exclusive.
    for (const attempt of [1, 2]) {
      setAttempt(attempt);
      await expect(screenshotWorkflow(input)).rejects.toBeInstanceOf(RetryableError);
    }

    expect(screenshotsMock.upsertScreenshot).not.toHaveBeenCalled();
  });

  it("caches a transient target failure as a miss on the final attempt", async () => {
    failCapture("upstream_temporary");
    setAttempt(3);

    const result = await screenshotWorkflow(input);

    expect(screenshotsMock.upsertScreenshot).toHaveBeenCalledWith(
      expect.objectContaining({ notFound: true, url: null }),
    );
    expect(result).toEqual(MISS);
  });

  it("keeps retrying an infrastructure failure on the final attempt, without caching", async () => {
    failCapture("sandbox_control_plane");
    setAttempt(3);

    await expect(screenshotWorkflow(input)).rejects.toBeInstanceOf(RetryableError);

    expect(screenshotsMock.upsertScreenshot).not.toHaveBeenCalled();
  });

  it("retries an unclassified error", async () => {
    screenshotMock.captureScreenshot.mockRejectedValue(new Error("boom"));

    await expect(screenshotWorkflow(input)).rejects.toBeInstanceOf(RetryableError);

    expect(screenshotsMock.upsertScreenshot).not.toHaveBeenCalled();
  });
});

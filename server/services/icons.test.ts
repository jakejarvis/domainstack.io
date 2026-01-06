/* @vitest-environment node */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Mock workflow/api module
const workflowMock = vi.hoisted(() => ({
  start: vi.fn(),
}));

vi.mock("workflow/api", () => workflowMock);

// Mock database repos to avoid DATABASE_URL requirement
vi.mock("@/lib/db/repos/provider-logos", () => ({
  getProviderLogoByProviderId: vi.fn(),
  upsertProviderLogo: vi.fn(),
}));

// Mock processIcon pipeline for getProviderIcon tests
vi.mock("@/lib/icons/pipeline", () => ({
  processIcon: vi.fn(),
}));

describe("getFavicon", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns favicon URL from successful workflow", async () => {
    workflowMock.start.mockReturnValue({
      runId: "test-run-1",
      returnValue: Promise.resolve({
        url: "https://blob.vercel-storage.com/favicon.webp",
        cached: false,
        notFound: false,
      }),
    });

    const { getFavicon } = await import("./icons");
    const result = await getFavicon("example.com");

    expect(workflowMock.start).toHaveBeenCalledOnce();
    expect(result.url).toBe("https://blob.vercel-storage.com/favicon.webp");
  });

  it("returns cached favicon URL", async () => {
    workflowMock.start.mockReturnValue({
      runId: "test-run-2",
      returnValue: Promise.resolve({
        url: "https://blob.vercel-storage.com/cached.webp",
        cached: true,
        notFound: false,
      }),
    });

    const { getFavicon } = await import("./icons");
    const result = await getFavicon("cached.com");

    expect(result.url).toBe("https://blob.vercel-storage.com/cached.webp");
  });

  it("returns null URL when favicon not found", async () => {
    workflowMock.start.mockReturnValue({
      runId: "test-run-3",
      returnValue: Promise.resolve({
        url: null,
        cached: false,
        notFound: true,
      }),
    });

    const { getFavicon } = await import("./icons");
    const result = await getFavicon("nofavicon.com");

    expect(result.url).toBeNull();
  });

  it("returns null URL when workflow fails", async () => {
    workflowMock.start.mockReturnValue({
      runId: "test-run-4",
      returnValue: Promise.reject(new Error("Workflow failed")),
    });

    const { getFavicon } = await import("./icons");
    // Should gracefully return null, not throw
    const result = await getFavicon("error.com");

    expect(result.url).toBeNull();
  });

  it("handles workflow returning null URL without notFound flag", async () => {
    workflowMock.start.mockReturnValue({
      runId: "test-run-5",
      returnValue: Promise.resolve({
        url: null,
        cached: false,
        notFound: false, // fetch failed but not 404
      }),
    });

    const { getFavicon } = await import("./icons");
    const result = await getFavicon("failed.com");

    expect(result.url).toBeNull();
  });
});

describe("getProviderIcon", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("calls processIcon with correct parameters", async () => {
    const { processIcon } = await import("@/lib/icons/pipeline");
    const mockProcessIcon = vi.mocked(processIcon);
    mockProcessIcon.mockResolvedValue({ url: "https://provider-logo.webp" });

    const { getProviderIcon } = await import("./icons");
    const result = await getProviderIcon("provider-123", "cloudflare.com");

    expect(mockProcessIcon).toHaveBeenCalledWith(
      expect.objectContaining({
        identifier: "provider-123",
        blobKind: "provider-logo",
        blobDomain: "cloudflare.com",
      }),
    );
    expect(result.url).toBe("https://provider-logo.webp");
  });

  it("returns cached provider logo from processIcon", async () => {
    const { processIcon } = await import("@/lib/icons/pipeline");
    const mockProcessIcon = vi.mocked(processIcon);
    mockProcessIcon.mockResolvedValue({
      url: "https://cached-provider-logo.webp",
    });

    const { getProviderIcon } = await import("./icons");
    const result = await getProviderIcon("provider-456", "aws.amazon.com");

    expect(result.url).toBe("https://cached-provider-logo.webp");
  });
});

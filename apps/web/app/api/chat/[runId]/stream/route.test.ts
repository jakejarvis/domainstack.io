import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { WorkflowRunNotFoundError } from "workflow/errors";

const mocks = vi.hoisted(() => ({
  checkRateLimit: vi.fn<() => Promise<unknown>>(),
  getSession: vi.fn<() => Promise<unknown>>(),
  getRun: vi.fn<(runId: string) => unknown>(),
  getReadable: vi.fn<(options: unknown) => ReadableStream>(),
  logger: {
    debug: vi.fn<(...args: unknown[]) => void>(),
    error: vi.fn<(...args: unknown[]) => void>(),
    warn: vi.fn<(...args: unknown[]) => void>(),
  },
}));

vi.mock("workflow/api", () => ({ getRun: mocks.getRun }));
vi.mock("@/lib/ratelimit/api", () => ({ checkRateLimit: mocks.checkRateLimit }));
vi.mock("@domainstack/auth/server", () => ({
  auth: { api: { getSession: mocks.getSession } },
}));
vi.mock("@domainstack/logger", () => ({ createLogger: () => mocks.logger }));

import { GET } from "./route";

function request() {
  return new NextRequest("https://domainstack.io/api/chat/run-1/stream");
}

function context() {
  return { params: Promise.resolve({ runId: "run-1" }) } as Parameters<typeof GET>[1];
}

function mockRun(exists: Promise<boolean>) {
  // Attach a no-op handler so a rejected promise isn't reported as unhandled before the route awaits it.
  exists.catch(() => {});
  mocks.getRun.mockReturnValue({
    get exists() {
      return exists;
    },
    getReadable: mocks.getReadable,
  });
}

describe("GET /api/chat/[runId]/stream", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getSession.mockResolvedValue(null);
    mocks.checkRateLimit.mockResolvedValue({ success: true, headers: {} });
    mocks.getReadable.mockImplementation(() => new ReadableStream({ start: (c) => c.close() }));
  });

  it("returns 404 without reading the stream when the run does not exist", async () => {
    mockRun(Promise.resolve(false));

    const response = await GET(request(), context());

    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toEqual({
      error: "Chat session completed or expired.",
    });
    expect(mocks.getReadable).not.toHaveBeenCalled();
  });

  it("maps a WorkflowRunNotFoundError from the existence check to 404", async () => {
    mockRun(Promise.reject(new WorkflowRunNotFoundError("run-1")));

    const response = await GET(request(), context());

    expect(response.status).toBe(404);
    expect(mocks.getReadable).not.toHaveBeenCalled();
    expect(mocks.logger.error).not.toHaveBeenCalled();
  });

  it("logs and returns 500 for an unexpected error", async () => {
    mockRun(Promise.reject(new Error("boom")));

    const response = await GET(request(), context());

    expect(response.status).toBe(500);
    expect(mocks.logger.error).toHaveBeenCalled();
    expect(mocks.getReadable).not.toHaveBeenCalled();
  });

  it("streams an existing run with its run id header", async () => {
    mockRun(Promise.resolve(true));

    const response = await GET(request(), context());

    expect(response.status).toBe(200);
    expect(response.headers.get("x-workflow-run-id")).toBe("run-1");
    expect(mocks.getReadable).toHaveBeenCalledWith({ startIndex: 0 });
  });
});

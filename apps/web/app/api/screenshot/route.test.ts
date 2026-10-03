import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  hookNotFound: new Error("hook not found"),
  runNotFound: new Error("run not found"),
  checkRateLimit: vi.fn<() => Promise<unknown>>(),
  getDomainById: vi.fn<(domainId: string) => Promise<unknown>>(),
  getHookByToken: vi.fn<(token: string) => Promise<{ runId: string }>>(),
  getRun: vi.fn<(runId: string) => { status: Promise<string>; returnValue?: Promise<unknown> }>(),
  getScreenshotByDomainId: vi.fn<(domainId: string) => Promise<unknown>>(),
  isDomainBlocked: vi.fn<(domain: string) => Promise<boolean>>(),
  start: vi.fn<(...args: unknown[]) => Promise<{ runId: string }>>(),
}));

vi.mock("workflow/api", () => ({
  getHookByToken: mocks.getHookByToken,
  getRun: mocks.getRun,
  start: mocks.start,
}));
vi.mock("workflow/errors", () => ({
  HookNotFoundError: { is: (error: unknown) => error === mocks.hookNotFound },
  WorkflowRunNotFoundError: { is: (error: unknown) => error === mocks.runNotFound },
}));
vi.mock("@/lib/ratelimit/api", () => ({ checkRateLimit: mocks.checkRateLimit }));
vi.mock("@domainstack/db/queries/blocked-domains", () => ({
  isDomainBlocked: mocks.isDomainBlocked,
}));
vi.mock("@domainstack/db/queries/domains", () => ({ getDomainById: mocks.getDomainById }));
vi.mock("@domainstack/db/queries/screenshots", () => ({
  getScreenshotByDomainId: mocks.getScreenshotByDomainId,
}));

import { GET, POST } from "./route";

const CROCKFORD = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";
function ulidAt(ms: number): string {
  let time = "";
  for (let i = 0; i < 10; i++) {
    time = CROCKFORD[ms % 32] + time;
    ms = Math.floor(ms / 32);
  }
  return `${time}${"0".repeat(16)}`;
}

function postRequest() {
  return new NextRequest("https://domainstack.io/api/screenshot", {
    method: "POST",
    body: JSON.stringify({ domainId: "domain-1" }),
    headers: { "Content-Type": "application/json" },
  });
}

describe("screenshot API", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.checkRateLimit.mockResolvedValue({ success: true });
    mocks.getDomainById.mockResolvedValue({ id: "domain-1", name: "example.com" });
    mocks.getScreenshotByDomainId.mockResolvedValue(null);
    mocks.getHookByToken.mockRejectedValue(mocks.hookNotFound);
    mocks.start.mockResolvedValue({ runId: "run-new" });
  });

  it("reuses the active workflow registered for a domain", async () => {
    mocks.getHookByToken.mockResolvedValue({ runId: "run-active" });

    const response = await POST(postRequest());

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ status: "running", runId: "run-active" });
    expect(mocks.getHookByToken).toHaveBeenCalledWith("screenshot:domain-1");
    expect(mocks.start).not.toHaveBeenCalled();
    expect(response.headers.get("Cache-Control")).toBe("no-cache, no-store");
  });

  it("passes the domain identity into a newly started workflow", async () => {
    const response = await POST(postRequest());

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ status: "running", runId: "run-new" });
    expect(mocks.start).toHaveBeenCalledWith(expect.any(Function), [
      { domain: "example.com", domainId: "domain-1" },
    ]);
  });

  it("hides the cached screenshot URL of a blocklisted domain", async () => {
    mocks.getScreenshotByDomainId.mockResolvedValue({
      url: "https://blob.example/x.webp",
      notFound: false,
    });
    mocks.isDomainBlocked.mockResolvedValue(true);

    const response = await POST(postRequest());

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.data).toEqual({ url: null, blocked: true });
    expect(mocks.isDomainBlocked).toHaveBeenCalledWith("example.com");
    expect(mocks.start).not.toHaveBeenCalled();
  });

  it("returns the cached screenshot URL for an unblocked domain", async () => {
    mocks.getScreenshotByDomainId.mockResolvedValue({
      url: "https://blob.example/x.webp",
      notFound: false,
    });
    mocks.isDomainBlocked.mockResolvedValue(false);

    const response = await POST(postRequest());

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.data).toEqual({ url: "https://blob.example/x.webp", blocked: false });
  });

  it("reports a cancelled workflow as terminal", async () => {
    mocks.getRun.mockReturnValue({ status: Promise.resolve("cancelled") });

    const response = await GET(
      new NextRequest("https://domainstack.io/api/screenshot?runId=run-cancelled"),
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      status: "failed",
      error: "workflow_cancelled",
    });
    expect(response.headers.get("Cache-Control")).toBe("no-cache, no-store");
  });

  it("reports a not-yet-visible young run as running", async () => {
    mocks.getRun.mockReturnValueOnce({ status: Promise.reject(mocks.runNotFound) });

    const response = await GET(
      new NextRequest(`https://domainstack.io/api/screenshot?runId=wrun_${ulidAt(Date.now())}`),
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ status: "running" });
    expect(response.headers.get("Cache-Control")).toBe("no-cache, no-store");
  });

  it("reports an old missing run as 404", async () => {
    mocks.getRun.mockReturnValueOnce({ status: Promise.reject(mocks.runNotFound) });

    const response = await GET(
      new NextRequest(
        `https://domainstack.io/api/screenshot?runId=wrun_${ulidAt(Date.now() - 120_000)}`,
      ),
    );

    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toEqual({ error: "Run not found" });
  });

  it("distinguishes a not-yet-visible run from a status backend failure", async () => {
    mocks.getRun.mockReturnValueOnce({ status: Promise.reject(mocks.runNotFound) });

    const notFoundResponse = await GET(
      new NextRequest("https://domainstack.io/api/screenshot?runId=run-pending"),
    );
    expect(notFoundResponse.status).toBe(404);
    await expect(notFoundResponse.json()).resolves.toEqual({ error: "Run not found" });

    mocks.getRun.mockReturnValueOnce({ status: Promise.reject(new Error("world unavailable")) });
    const unavailableResponse = await GET(
      new NextRequest("https://domainstack.io/api/screenshot?runId=run-pending"),
    );
    expect(unavailableResponse.status).toBe(503);
    await expect(unavailableResponse.json()).resolves.toEqual({
      error: "Workflow status unavailable",
    });
  });
});

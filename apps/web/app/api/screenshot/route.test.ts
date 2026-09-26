import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  hookNotFound: new Error("hook not found"),
  runNotFound: new Error("run not found"),
  checkRateLimit: vi.fn<() => Promise<unknown>>(),
  getDomainById: vi.fn<(domainId: string) => Promise<unknown>>(),
  findDomainByName: vi.fn<(name: string) => Promise<unknown>>(),
  ensureDomainRecord: vi.fn<(name: string) => Promise<unknown>>(),
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
vi.mock("@domainstack/db/queries/domains", () => ({
  getDomainById: mocks.getDomainById,
  findDomainByName: mocks.findDomainByName,
  ensureDomainRecord: mocks.ensureDomainRecord,
}));
vi.mock("@domainstack/db/queries/screenshots", () => ({
  getScreenshotByDomainId: mocks.getScreenshotByDomainId,
}));

import { GET, POST } from "./route";

function postRequest(body: unknown = { domainId: "domain-1" }) {
  return new NextRequest("https://domainstack.io/api/screenshot", {
    method: "POST",
    body: JSON.stringify(body),
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

  it("resolves a hostname to its own row, not its registrable parent's", async () => {
    mocks.findDomainByName.mockResolvedValue(null);
    mocks.ensureDomainRecord.mockResolvedValue({ id: "host-1", name: "api.example.com" });
    mocks.getDomainById.mockResolvedValue({ id: "host-1", name: "api.example.com" });

    const response = await POST(postRequest({ domain: "API.Example.com" }));

    expect(response.status).toBe(200);
    expect(mocks.findDomainByName).toHaveBeenCalledWith("api.example.com");
    expect(mocks.ensureDomainRecord).toHaveBeenCalledWith("api.example.com");
    expect(mocks.getDomainById).toHaveBeenCalledWith("host-1");
    expect(mocks.start).toHaveBeenCalledWith(expect.any(Function), [
      { domain: "api.example.com", domainId: "host-1" },
    ]);
  });

  it("reuses an existing hostname row", async () => {
    mocks.findDomainByName.mockResolvedValue({ id: "host-1", name: "www.example.com" });
    mocks.getDomainById.mockResolvedValue({ id: "host-1", name: "www.example.com" });

    await POST(postRequest({ domain: "www.example.com" }));

    expect(mocks.ensureDomainRecord).not.toHaveBeenCalled();
    expect(mocks.getDomainById).toHaveBeenCalledWith("host-1");
  });

  it("rejects an invalid hostname or a missing target", async () => {
    expect((await POST(postRequest({ domain: "not a domain" }))).status).toBe(400);
    expect((await POST(postRequest({}))).status).toBe(400);
    expect(mocks.ensureDomainRecord).not.toHaveBeenCalled();
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

/* @vitest-environment node */
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getUserAvatarUrl: vi.fn<(userId: string) => Promise<string | null>>(),
  safeFetch: vi.fn<(options: unknown) => Promise<unknown>>(),
}));

vi.mock("next/server", async (importOriginal) => ({
  ...(await importOriginal<typeof import("next/server")>()),
  connection: vi.fn<() => Promise<void>>(),
}));
vi.mock("@domainstack/db/queries/users", () => ({
  getUserAvatarUrl: mocks.getUserAvatarUrl,
}));
vi.mock("@domainstack/safe-fetch", () => ({ safeFetch: mocks.safeFetch }));

import { NextRequest } from "next/server";

import { SafeFetchError } from "@domainstack/safe-fetch/errors";

import { GET } from "./route";

const call = () =>
  GET(new NextRequest("https://domainstack.io/api/avatar/u1"), {
    params: Promise.resolve({ userId: "u1" }),
  });

const upstream = (contentType: string | null) =>
  mocks.safeFetch.mockResolvedValue({
    ok: true,
    status: 200,
    contentType,
    buffer: Buffer.from([1, 2, 3]),
  });

describe("GET /api/avatar/[userId]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getUserAvatarUrl.mockResolvedValue("https://cdn.example.com/a.png");
  });

  it("serves an allowlisted raster type with hardening headers", async () => {
    upstream("image/png");

    const response = await call();

    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Type")).toBe("image/png");
    expect(response.headers.get("X-Content-Type-Options")).toBe("nosniff");
    expect(response.headers.get("Content-Security-Policy")).toContain("sandbox");
  });

  it("normalizes case and parameters on an allowlisted type", async () => {
    upstream("Image/PNG; charset=binary");

    const response = await call();

    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Type")).toBe("image/png");
  });

  it.each([
    ["image/svg+xml"],
    ["image/svg+xml; charset=utf-8"],
    ["IMAGE/SVG+XML"],
    ["text/html"],
    [null],
  ])("rejects content type %s with 502", async (contentType) => {
    upstream(contentType);

    const response = await call();

    expect(response.status).toBe(502);
  });

  it("returns 404 when the user has no avatar URL", async () => {
    mocks.getUserAvatarUrl.mockResolvedValue(null);

    const response = await call();

    expect(response.status).toBe(404);
    expect(mocks.safeFetch).not.toHaveBeenCalled();
  });

  it("returns 403 when the avatar host resolves to a private IP", async () => {
    mocks.safeFetch.mockRejectedValue(new SafeFetchError("private_ip", "blocked"));

    const response = await call();

    expect(response.status).toBe(403);
  });
});

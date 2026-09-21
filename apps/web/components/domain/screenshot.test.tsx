import { QueryClientProvider } from "@tanstack/react-query";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { page } from "vitest/browser";

vi.mock("@/lib/analytics/client", () => ({
  analytics: {
    track: vi.fn<(event: string, properties?: Record<string, unknown>) => void>(),
    trackException: vi.fn<(error: unknown, context?: Record<string, unknown>) => void>(),
  },
}));
vi.mock("sonner", () => ({
  toast: { error: vi.fn<(message: string, options?: unknown) => void>() },
}));

import { createTestQueryClient, render, renderHook } from "@/mocks/react";

import { Screenshot, useScreenshot } from "./screenshot";

// A same-origin static asset keeps this test fully offline: the test server
// serves it locally, so nothing depends on
// example.public.blob.vercel-storage.com or any other external host.
const screenshotUrl = "/web-app-manifest-192x192.png";

function jsonResponse(body: unknown, init?: ResponseInit) {
  const headers = new Headers(init?.headers);
  headers.set("Content-Type", "application/json");
  return new Response(JSON.stringify(body), {
    ...init,
    headers,
  });
}

describe("useScreenshot", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("recovers after an early status lookup fails", async () => {
    const fetchMock = vi.mocked(fetch);
    fetchMock
      .mockResolvedValueOnce(jsonResponse({ status: "running", runId: "run-1" }))
      .mockResolvedValueOnce(jsonResponse({ error: "Run not found" }, { status: 404 }))
      .mockResolvedValueOnce(
        jsonResponse({
          status: "completed",
          cached: false,
          success: true,
          data: { url: screenshotUrl },
        }),
      );

    const queryClient = createTestQueryClient();
    const view = await renderHook(
      () => useScreenshot({ domain: "example.com", domainId: "domain-1" }),
      {
        wrapper: ({ children }) => (
          <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
        ),
      },
    );

    await vi.waitFor(() =>
      expect(queryClient.getQueryData(["screenshot", "domain-1"])).toEqual({
        status: "running",
        runId: "run-1",
      }),
    );
    await queryClient.refetchQueries({ queryKey: ["screenshot", "domain-1"] });
    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
    expect(view.result.current.isLoading).toBe(true);

    await queryClient.refetchQueries({ queryKey: ["screenshot", "domain-1"] });
    await vi.waitFor(() =>
      expect(queryClient.getQueryData(["screenshot", "domain-1"])).toMatchObject({
        status: "completed",
        data: { url: screenshotUrl },
      }),
    );
    await vi.waitFor(() => expect(view.result.current.data?.url).toBe(screenshotUrl));
    expect(view.result.current.isLoading).toBe(false);
  });

  it("backs off through repeated poll failures, then gives up instead of polling forever", async () => {
    const fetchMock = vi.mocked(fetch);
    fetchMock.mockResolvedValueOnce(jsonResponse({ status: "running", runId: "run-flaky" }));
    // 5 consecutive poll failures (network/5xx) — one more than
    // MAX_CONSECUTIVE_FAILURES's cap of 5 is never reached because the 5th
    // failure itself is the one that gives up.
    for (let i = 0; i < 5; i++) {
      fetchMock.mockResolvedValueOnce(jsonResponse({ error: "boom" }, { status: 500 }));
    }

    const queryClient = createTestQueryClient();
    const view = await renderHook(
      () => useScreenshot({ domain: "example.com", domainId: "domain-1" }),
      {
        wrapper: ({ children }) => (
          <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
        ),
      },
    );

    await vi.waitFor(() =>
      expect(queryClient.getQueryData(["screenshot", "domain-1"])).toEqual({
        status: "running",
        runId: "run-flaky",
      }),
    );

    for (let attempt = 1; attempt <= 4; attempt++) {
      await queryClient.refetchQueries({ queryKey: ["screenshot", "domain-1"] });
      await vi.waitFor(() =>
        expect(queryClient.getQueryData(["screenshot", "domain-1"])).toEqual({
          status: "retrying",
          attempt,
          runId: "run-flaky",
        }),
      );
      // Still shown as loading while quietly backing off, not as an error.
      expect(view.result.current.isLoading).toBe(true);
      expect(view.result.current.hasFailed).toBe(false);
    }

    // The 5th consecutive failure gives up rather than scheduling another retry.
    await queryClient.refetchQueries({ queryKey: ["screenshot", "domain-1"] });
    await vi.waitFor(() =>
      expect(queryClient.getQueryData(["screenshot", "domain-1"])).toMatchObject({
        status: "failed",
      }),
    );
    expect(view.result.current.hasFailed).toBe(true);
    expect(view.result.current.isLoading).toBe(false);

    // No POST was re-issued: every retry after the initial start polled the
    // same run instead of re-triggering the expensive Puppeteer capture.
    const postRequests = fetchMock.mock.calls.filter(([, init]) => init?.method === "POST");
    expect(postRequests).toHaveLength(1);
    expect(fetchMock).toHaveBeenCalledTimes(6);
  });

  it("shares an active run across observers and remounts", async () => {
    const fetchMock = vi.mocked(fetch);
    fetchMock
      .mockResolvedValueOnce(jsonResponse({ status: "running", runId: "run-shared" }))
      .mockResolvedValue(
        jsonResponse({
          status: "completed",
          cached: false,
          success: true,
          data: { url: screenshotUrl },
        }),
      );

    const queryClient = createTestQueryClient();
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );
    const first = await renderHook(
      () => useScreenshot({ domain: "example.com", domainId: "domain-1" }),
      { wrapper },
    );
    await vi.waitFor(() =>
      expect(queryClient.getQueryData(["screenshot", "domain-1"])).toEqual({
        status: "running",
        runId: "run-shared",
      }),
    );

    await first.unmount();
    const second = await renderHook(
      () => useScreenshot({ domain: "example.com", domainId: "domain-1" }),
      { wrapper },
    );

    await vi.waitFor(() =>
      expect(queryClient.getQueryData(["screenshot", "domain-1"])).toMatchObject({
        status: "completed",
        data: { url: screenshotUrl },
      }),
    );
    await vi.waitFor(() => expect(second.result.current.data?.url).toBe(screenshotUrl));
    const postRequests = fetchMock.mock.calls.filter(([, init]) => init?.method === "POST");
    expect(postRequests).toHaveLength(1);
  });
});

describe("Screenshot", () => {
  it("lets the user reload an image that failed without refreshing the page", async () => {
    await render(
      <Screenshot
        domain="example.com"
        data={{ url: screenshotUrl, blocked: false }}
        isLoading={false}
      />,
    );

    const image = page.getByRole("img", { name: "Homepage preview of example.com" });
    await expect.element(image).toBeInTheDocument();
    image.element().dispatchEvent(new Event("error"));
    const reloadButton = page.getByRole("button", { name: "Reload preview" });
    await expect.element(reloadButton).toBeInTheDocument();

    await reloadButton.click();
    const reloadedImage = page
      .getByRole("img", { name: "Homepage preview of example.com" })
      .element() as HTMLImageElement;
    expect(reloadedImage.src).toContain("domainstack-reload=1");
  });
});

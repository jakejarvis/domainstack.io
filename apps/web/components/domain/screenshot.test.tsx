import { focusManager, QueryClientProvider } from "@tanstack/react-query";
import { toast } from "sonner";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { page } from "vitest/browser";

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

  it("recovers after an early status lookup fails transiently", async () => {
    const fetchMock = vi.mocked(fetch);
    fetchMock
      .mockResolvedValueOnce(jsonResponse({ status: "running", runId: "run-1" }))
      // A 5xx is transient and worth retrying — unlike a 404 (the run is
      // gone for good), which fails immediately instead of retrying.
      .mockResolvedValueOnce(jsonResponse({ error: "Internal error" }, { status: 500 }))
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
    await vi.waitFor(() => expect(view.result.current.hasFailed).toBe(true));
    expect(view.result.current.isLoading).toBe(false);

    // No POST was re-issued: every retry after the initial start polled the
    // same run instead of re-triggering the expensive Puppeteer capture.
    const postRequests = fetchMock.mock.calls.filter(([, init]) => init?.method === "POST");
    expect(postRequests).toHaveLength(1);
    expect(fetchMock).toHaveBeenCalledTimes(6);
  });

  it("does not bypass the backoff delay by remounting while retrying", async () => {
    const fetchMock = vi.mocked(fetch);
    fetchMock
      .mockResolvedValueOnce(jsonResponse({ status: "running", runId: "run-flaky" }))
      .mockResolvedValueOnce(jsonResponse({ error: "boom" }, { status: 500 }));

    const queryClient = createTestQueryClient();
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );
    const first = await renderHook(
      () => useScreenshot({ domain: "example.com", domainId: "domain-1" }),
      { wrapper },
    );

    await vi.waitFor(() =>
      expect(queryClient.getQueryData(["screenshot", "domain-1"])).toMatchObject({
        status: "running",
      }),
    );
    await queryClient.refetchQueries({ queryKey: ["screenshot", "domain-1"] });
    await vi.waitFor(() =>
      expect(queryClient.getQueryData(["screenshot", "domain-1"])).toEqual({
        status: "retrying",
        attempt: 1,
        runId: "run-flaky",
      }),
    );

    const callsBeforeRemount = fetchMock.mock.calls.length;
    await first.unmount();
    await renderHook(() => useScreenshot({ domain: "example.com", domainId: "domain-1" }), {
      wrapper,
    });

    // The backoff delay is several seconds; a remount-triggered refetch
    // would show up well within a fake-timer-free short wait.
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(fetchMock.mock.calls.length).toBe(callsBeforeRemount);
  });

  it("waits out a rate limit instead of re-requesting on remount or window focus", async () => {
    const fetchMock = vi.mocked(fetch);
    fetchMock.mockImplementation(async () =>
      jsonResponse({}, { status: 429, headers: { "Retry-After": "30" } }),
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
      expect(queryClient.getQueryData(["screenshot", "domain-1"])).toMatchObject({
        status: "rate_limited",
        retryAfter: 30,
      }),
    );

    const callsBeforeRemount = fetchMock.mock.calls.length;
    await first.unmount();
    await renderHook(() => useScreenshot({ domain: "example.com", domainId: "domain-1" }), {
      wrapper,
    });
    try {
      focusManager.setFocused(false);
      focusManager.setFocused(true);
      await new Promise((resolve) => setTimeout(resolve, 50));
    } finally {
      focusManager.setFocused(undefined);
    }

    // Neither the remount nor the focus re-POSTed the start request early.
    expect(fetchMock.mock.calls.length).toBe(callsBeforeRemount);
  });

  it("reports a repeated, identical rate limit only once", async () => {
    vi.mocked(toast.error).mockClear();
    const fetchMock = vi.mocked(fetch);
    fetchMock.mockImplementation(async () =>
      jsonResponse({}, { status: 429, headers: { "Retry-After": "30" } }),
    );

    const queryClient = createTestQueryClient();
    await renderHook(() => useScreenshot({ domain: "example.com", domainId: "domain-1" }), {
      wrapper: ({ children }) => (
        <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
      ),
    });

    await vi.waitFor(() =>
      expect(queryClient.getQueryData(["screenshot", "domain-1"])).toMatchObject({
        status: "rate_limited",
      }),
    );
    await queryClient.refetchQueries({ queryKey: ["screenshot", "domain-1"] });

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(toast.error).toHaveBeenCalledTimes(1);
  });

  it("self-heals after giving up, instead of staying failed until the query is garbage-collected", async () => {
    const fetchMock = vi.mocked(fetch);
    fetchMock.mockResolvedValueOnce(jsonResponse({ status: "running", runId: "run-flaky" }));
    for (let i = 0; i < 5; i++) {
      fetchMock.mockResolvedValueOnce(jsonResponse({ error: "boom" }, { status: 500 }));
    }

    const queryClient = createTestQueryClient();
    await renderHook(() => useScreenshot({ domain: "example.com", domainId: "domain-1" }), {
      wrapper: ({ children }) => (
        <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
      ),
    });

    await vi.waitFor(() =>
      expect(queryClient.getQueryData(["screenshot", "domain-1"])).toMatchObject({
        status: "running",
      }),
    );
    for (let attempt = 0; attempt < 5; attempt++) {
      await queryClient.refetchQueries({ queryKey: ["screenshot", "domain-1"] });
    }
    await vi.waitFor(() =>
      expect(queryClient.getQueryData(["screenshot", "domain-1"])).toMatchObject({
        status: "failed",
        recoverable: true,
      }),
    );

    // Simulates the long cooldown's refetchInterval firing: this must not be
    // a no-op (it wasn't marked fully terminal), and starts a fresh capture
    // since the old run is presumed gone after such a long gap.
    fetchMock.mockResolvedValueOnce(jsonResponse({ status: "running", runId: "run-recovered" }));
    await queryClient.refetchQueries({ queryKey: ["screenshot", "domain-1"] });
    await vi.waitFor(() =>
      expect(queryClient.getQueryData(["screenshot", "domain-1"])).toEqual({
        status: "running",
        runId: "run-recovered",
      }),
    );
  });

  it("fails immediately on a 404 poll instead of retrying a run that's gone for good", async () => {
    const fetchMock = vi.mocked(fetch);
    fetchMock
      .mockResolvedValueOnce(jsonResponse({ status: "running", runId: "run-gone" }))
      .mockResolvedValueOnce(jsonResponse({ error: "Run not found" }, { status: 404 }));

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
        runId: "run-gone",
      }),
    );

    await queryClient.refetchQueries({ queryKey: ["screenshot", "domain-1"] });
    await vi.waitFor(() =>
      expect(queryClient.getQueryData(["screenshot", "domain-1"])).toEqual({
        status: "failed",
        error: "Run not found",
      }),
    );
    await vi.waitFor(() => expect(view.result.current.hasFailed).toBe(true));
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

import { afterEach, describe, expect, it, vi } from "vitest";
import { page } from "vitest/browser";

const { useScreenshotMock } = vi.hoisted(() => ({
  useScreenshotMock:
    vi.fn<(options: { domain: string; domainId?: string; enabled?: boolean }) => unknown>(),
}));

vi.mock("@/components/domain/screenshot", () => ({
  useScreenshot: (options: { domain: string; domainId?: string; enabled?: boolean }) => {
    useScreenshotMock(options);
    return { data: undefined, isLoading: false };
  },
  Screenshot: () => <div data-testid="screenshot" />,
}));

import { render } from "@/mocks/react";

import { ScreenshotPopover } from "./screenshot-popover";

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

function lastEnabled() {
  return useScreenshotMock.mock.lastCall?.[0].enabled;
}

describe("ScreenshotPopover", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("does not start a screenshot when the pointer only passes through", async () => {
    useScreenshotMock.mockClear();
    await render(
      <ScreenshotPopover domain="example.com" domainId="d1">
        <span>example.com</span>
      </ScreenshotPopover>,
    );

    // Fake only the open-delay timer so the result doesn't depend on how long
    // the hover/unhover round-trips to the browser take under load.
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
    const link = page.getByText("example.com", { exact: true });
    await link.hover();
    vi.advanceTimersByTime(300);
    await link.unhover();
    // Outlast the open delay: a pass-through hover must never open the popover.
    vi.advanceTimersByTime(1000);

    expect(useScreenshotMock).toHaveBeenCalled();
    expect(lastEnabled()).toBe(false);
    expect(useScreenshotMock.mock.calls.some(([options]) => options.enabled === true)).toBe(false);
  });

  it("starts the screenshot once the pointer rests on the trigger", async () => {
    useScreenshotMock.mockClear();
    await render(
      <ScreenshotPopover domain="example.com" domainId="d1">
        <span>example.com</span>
      </ScreenshotPopover>,
    );

    await page.getByText("example.com", { exact: true }).hover();
    await wait(600);

    await vi.waitFor(() => expect(lastEnabled()).toBe(true));
  });
});

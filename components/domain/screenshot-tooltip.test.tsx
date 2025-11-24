/* @vitest-environment jsdom */
import { fireEvent, render, screen } from "@testing-library/react";
import type { Mock } from "vitest";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ScreenshotTooltip } from "./screenshot-tooltip";

vi.mock("@/components/ui/tooltip", () => ({
  Tooltip: ({ children }: { children: React.ReactNode }) => (
    <div data-slot="tooltip">{children}</div>
  ),
  TooltipTrigger: ({ children }: { children: React.ReactNode }) => (
    <button type="button" data-slot="tooltip-trigger">
      {children}
    </button>
  ),
  TooltipContent: ({ children }: { children: React.ReactNode }) => (
    <div data-slot="tooltip-content">{children}</div>
  ),
}));

vi.mock("next/image", () => ({
  __esModule: true,
  default: ({ alt, src }: { alt: string; src: string }) => (
    // biome-ignore lint/performance/noImgElement: just a test
    <img alt={alt} src={src} data-slot="image" />
  ),
}));

vi.mock("@/lib/trpc/client", () => ({
  useTRPC: () => ({
    domain: {
      getScreenshot: {
        queryOptions: (vars: unknown) => ({
          queryKey: ["getScreenshot", vars],
        }),
      },
    },
  }),
}));

vi.mock("@tanstack/react-query", async () => {
  const actual = await vi.importActual<typeof import("@tanstack/react-query")>(
    "@tanstack/react-query",
  );
  return {
    ...actual,
    useQuery: vi.fn(),
  };
});

const { useQuery } = await import("@tanstack/react-query");

describe("ScreenshotTooltip", () => {
  beforeEach(() => {
    (useQuery as unknown as Mock).mockReset();
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("fetches on open and shows loading UI", () => {
    (useQuery as unknown as Mock).mockReturnValue({
      data: undefined,
      isLoading: true,
      isFetching: false,
    });
    render(
      <ScreenshotTooltip domain="example.com">
        <span>hover me</span>
      </ScreenshotTooltip>,
    );
    // Simulate open by clicking the trigger
    fireEvent.click(screen.getByText("hover me"));
    expect(screen.getByText(/taking screenshot/i)).toBeInTheDocument();
  });

  it("renders image when loaded", () => {
    (useQuery as unknown as Mock).mockReturnValue({
      data: {
        url: "https://test-store.public.blob.vercel-storage.com/abcdef0123456789abcdef0123456789/1200x630.webp",
      },
      isLoading: false,
      isFetching: false,
    });
    render(
      <ScreenshotTooltip domain="example.com">
        <span>hover me</span>
      </ScreenshotTooltip>,
    );
    fireEvent.click(screen.getByText("hover me"));
    const img = screen.getByRole("img", {
      name: /homepage preview of example.com/i,
    });
    expect(img).toHaveAttribute(
      "src",
      "https://test-store.public.blob.vercel-storage.com/abcdef0123456789abcdef0123456789/1200x630.webp",
    );
  });
});

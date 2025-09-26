import { fireEvent, render, screen } from "@testing-library/react";
import type React from "react";
import type { Mock } from "vitest";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ScreenshotTooltip } from "./screenshot-tooltip";

// Mock tooltip primitives to render immediately without portals
vi.mock("@/components/ui/tooltip", () => ({
  Tooltip: ({
    children,
    ...props
  }: { children: React.ReactNode } & Record<string, unknown>) => (
    <div data-slot="tooltip" {...props}>
      {children}
    </div>
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
      screenshot: {
        queryOptions: (vars: unknown) => ({ queryKey: ["screenshot", vars] }),
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
    expect(screen.getByText(/loading screenshot/i)).toBeInTheDocument();
  });

  it("renders image when loaded", () => {
    (useQuery as unknown as Mock).mockReturnValue({
      data: { url: "https://blob/url.png" },
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
    expect(img).toHaveAttribute("src", "https://blob/url.png");
  });
});

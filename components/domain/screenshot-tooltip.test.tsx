/* @vitest-environment jsdom */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@/lib/test-utils";
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

// Mock the tRPC client to return a mock queryOptions function
const mockQueryOptions = vi.fn();

vi.mock("@/lib/trpc/client", () => ({
  useTRPC: () => ({
    domain: {
      getScreenshot: {
        queryOptions: mockQueryOptions,
      },
    },
  }),
}));

describe("ScreenshotTooltip", () => {
  beforeEach(() => {
    mockQueryOptions.mockClear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("fetches on open and shows loading UI", async () => {
    // Configure mock to return queryOptions that keep loading state
    mockQueryOptions.mockImplementation(({ domain }: { domain: string }) => ({
      queryKey: ["getScreenshot", { domain }],
      queryFn: () => new Promise(() => {}), // Never resolves to keep loading state
    }));

    render(
      <ScreenshotTooltip domain="example.com">
        <span>hover me</span>
      </ScreenshotTooltip>,
    );

    // Simulate open by clicking the trigger
    fireEvent.click(screen.getByText("hover me"));

    // Should show loading state
    await waitFor(() => {
      expect(screen.getByText(/taking screenshot/i)).toBeInTheDocument();
    });
  });

  it("renders image when loaded", async () => {
    const screenshotUrl =
      "https://test-store.public.blob.vercel-storage.com/abcdef0123456789abcdef0123456789/1200x630.webp";

    mockQueryOptions.mockImplementation(({ domain }: { domain: string }) => ({
      queryKey: ["getScreenshot", { domain }],
      queryFn: async () => ({ url: screenshotUrl }),
    }));

    render(
      <ScreenshotTooltip domain="example.com">
        <span>hover me</span>
      </ScreenshotTooltip>,
    );

    fireEvent.click(screen.getByText("hover me"));

    // Wait for the image to be rendered
    await waitFor(() => {
      const img = screen.queryByRole("img", {
        name: /homepage preview of example.com/i,
      });
      expect(img).toBeInTheDocument();
    });

    const img = screen.getByRole("img", {
      name: /homepage preview of example.com/i,
    });
    expect(img).toHaveAttribute("src", screenshotUrl);
  });
});

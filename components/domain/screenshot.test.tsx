/* @vitest-environment jsdom */
import { createElement } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@/lib/test-utils";
import { Screenshot } from "./screenshot";

vi.mock("next/image", () => ({
  __esModule: true,
  default: ({
    alt,
    src,
    width,
    height,
  }: {
    alt: string;
    src: string;
    width: number;
    height: number;
  }) =>
    createElement("img", {
      alt,
      src,
      width,
      height,
      "data-slot": "image",
    }),
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

describe("Screenshot", () => {
  beforeEach(() => {
    mockQueryOptions.mockClear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("shows loading UI during fetch", async () => {
    // Configure mock to return queryOptions that keep loading state
    mockQueryOptions.mockImplementation(({ domain }: { domain: string }) => ({
      queryKey: ["getScreenshot", { domain }],
      queryFn: () => new Promise(() => {}), // Never resolves to keep loading state
    }));

    render(<Screenshot domain="example.com" />);

    // Should show loading state
    await waitFor(() => {
      expect(screen.getByText(/taking screenshot/i)).toBeInTheDocument();
    });
  });

  it("renders image when url present", async () => {
    const screenshotUrl =
      "https://test-store.public.blob.vercel-storage.com/abcdef0123456789abcdef0123456789/1200x630.webp";

    mockQueryOptions.mockImplementation(({ domain }: { domain: string }) => ({
      queryKey: ["getScreenshot", { domain }],
      queryFn: async () => ({ url: screenshotUrl }),
    }));

    render(<Screenshot domain="example.com" />);

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

  it("shows fallback when no url and not loading", async () => {
    mockQueryOptions.mockImplementation(({ domain }: { domain: string }) => ({
      queryKey: ["getScreenshot", { domain }],
      queryFn: async () => ({ url: null }),
    }));

    render(<Screenshot domain="example.com" />);

    // Wait for query to complete
    await waitFor(() => {
      expect(screen.getByText(/unable to take/i)).toBeInTheDocument();
    });
  });
});

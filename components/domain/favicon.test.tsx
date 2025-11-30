/* @vitest-environment jsdom */
import { createElement } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@/lib/test-utils";
import { Favicon } from "./favicon";

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
      getFavicon: {
        queryOptions: mockQueryOptions,
      },
    },
  }),
}));

describe("Favicon", () => {
  beforeEach(() => {
    mockQueryOptions.mockClear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("shows skeleton while loading (after mount)", async () => {
    // Configure mock to return queryOptions that React Query will use
    mockQueryOptions.mockImplementation(({ domain }: { domain: string }) => ({
      queryKey: ["getFavicon", { domain }],
      queryFn: () => new Promise(() => {}), // Never resolves to keep loading state
    }));

    render(<Favicon domain="example.com" size={16} />);

    // Initial render shows skeleton due to not mounted
    expect(
      document.querySelectorAll('[data-slot="skeleton"]').length,
    ).toBeGreaterThan(0);

    // Wait for mount effect
    await waitFor(() => {
      const skeletons = document.querySelectorAll('[data-slot="skeleton"]');
      expect(skeletons.length).toBeGreaterThan(0);
    });
  });

  it("shows letter avatar when no url (after mount)", async () => {
    // Configure mock to return queryOptions with null URL
    mockQueryOptions.mockImplementation(({ domain }: { domain: string }) => ({
      queryKey: ["getFavicon", { domain }],
      queryFn: async () => ({ url: null }),
    }));

    render(<Favicon domain="example.com" size={16} />);

    // Wait for query to complete and component to mount
    await waitFor(() => {
      const avatar = screen.queryByText("E");
      expect(avatar).toBeInTheDocument();
    });

    const avatar = screen.getByText("E");
    expect(avatar).toHaveAttribute("data-favicon", "example.com");
    expect(avatar).toHaveAttribute("role", "img");

    // Ensure we did not render the next/image <img> fallback
    expect(document.querySelector('[data-slot="image"]')).toBeNull();
  });

  it("shows domain letter avatar when no url and not loading", async () => {
    mockQueryOptions.mockImplementation(({ domain }: { domain: string }) => ({
      queryKey: ["getFavicon", { domain }],
      queryFn: async () => ({ url: null }),
    }));

    render(<Favicon domain="example.com" size={16} />);

    // Wait for query to complete
    await waitFor(() => {
      expect(screen.queryByText("E")).toBeInTheDocument();
    });

    // Should show letter 'E' for example.com
    const avatar = screen.getByText("E");
    expect(avatar).toBeInTheDocument();
    expect(avatar).toHaveAttribute("data-favicon", "example.com");
    expect(avatar).toHaveAttribute("role", "img");

    // Ensure we did not render the next/image <img> fallback
    expect(document.querySelector('[data-slot="image"]')).toBeNull();
  });

  it("generates consistent colors for same domain", async () => {
    mockQueryOptions.mockImplementation(({ domain }: { domain: string }) => ({
      queryKey: ["getFavicon", { domain }],
      queryFn: async () => ({ url: null }),
    }));

    const { unmount } = render(<Favicon domain="example.com" size={16} />);

    await waitFor(() => {
      expect(screen.queryByText("E")).toBeInTheDocument();
    });

    const firstAvatar = screen.getByText("E");
    const firstClass = firstAvatar.className;
    const firstStyle = firstAvatar.getAttribute("style");
    unmount();

    render(<Favicon domain="example.com" size={16} />);

    await waitFor(() => {
      expect(screen.queryByText("E")).toBeInTheDocument();
    });

    const secondAvatar = screen.getByText("E");
    expect(secondAvatar.className).toBe(firstClass);
    expect(secondAvatar.getAttribute("style")).toBe(firstStyle);
  });

  it("renders Image when url present", async () => {
    const faviconUrl =
      "https://test-store.public.blob.vercel-storage.com/abcdef0123456789abcdef0123456789/32x32.webp";

    mockQueryOptions.mockImplementation(({ domain }: { domain: string }) => ({
      queryKey: ["getFavicon", { domain }],
      queryFn: async () => ({ url: faviconUrl }),
    }));

    render(<Favicon domain="example.com" size={16} />);

    // Wait for the image to be rendered
    await waitFor(() => {
      const img = screen.queryByRole("img", { name: /icon/i });
      expect(img).toBeInTheDocument();
    });

    const img = screen.getByRole("img", { name: /icon/i });
    expect(img).toHaveAttribute("src", faviconUrl);
  });
});

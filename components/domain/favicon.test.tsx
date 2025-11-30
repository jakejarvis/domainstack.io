/* @vitest-environment jsdom */
import { render, screen } from "@testing-library/react";
import { createElement } from "react";
import type { Mock } from "vitest";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
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

vi.mock("@/lib/trpc/client", () => ({
  useTRPC: () => ({
    domain: {
      getFavicon: {
        queryOptions: (vars: unknown) => ({
          queryKey: ["getFavicon", vars],
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

describe("Favicon", () => {
  beforeEach(() => {
    (useQuery as unknown as Mock).mockReset();
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("shows skeleton while loading (after mount)", () => {
    (useQuery as unknown as Mock).mockReturnValue({
      data: undefined,
      isPending: true,
      isPlaceholderData: false,
    });

    render(<Favicon domain="example.com" size={16} />);

    // While loading, should show skeleton
    const skeletons = document.querySelectorAll('[data-slot="skeleton"]');
    expect(skeletons.length).toBeGreaterThan(0);
  });

  it("shows letter avatar when no url (after mount)", () => {
    (useQuery as unknown as Mock).mockReturnValue({
      data: { url: null },
      isPending: false,
      isPlaceholderData: false,
    });

    render(<Favicon domain="example.com" size={16} />);

    // After mount, when no favicon URL, should show letter avatar
    const avatar = screen.getByText("E");
    expect(avatar).toBeInTheDocument();
    expect(avatar).toHaveAttribute("data-favicon", "example.com");
    expect(avatar).toHaveAttribute("role", "img");

    // Ensure we did not render the next/image <img> fallback
    expect(document.querySelector('[data-slot="image"]')).toBeNull();
  });

  it("shows domain letter avatar when no url and not loading", () => {
    (useQuery as unknown as Mock).mockReturnValue({
      data: { url: null },
      isPending: false,
      isPlaceholderData: false,
    });
    render(<Favicon domain="example.com" size={16} />);

    // Should show letter 'E' for example.com
    const avatar = screen.getByText("E");
    expect(avatar).toBeInTheDocument();
    expect(avatar).toHaveAttribute("data-favicon", "example.com");
    expect(avatar).toHaveAttribute("role", "img");

    // Ensure we did not render the next/image <img> fallback
    expect(document.querySelector('[data-slot="image"]')).toBeNull();
  });

  it("generates consistent colors for same domain", () => {
    (useQuery as unknown as Mock).mockReturnValue({
      data: { url: null },
      isPending: false,
      isPlaceholderData: false,
    });

    const { unmount } = render(<Favicon domain="example.com" size={16} />);
    const firstAvatar = screen.getByText("E");
    const firstClass = firstAvatar.className;
    unmount();

    render(<Favicon domain="example.com" size={16} />);
    const secondAvatar = screen.getByText("E");
    expect(secondAvatar.className).toBe(firstClass);
  });

  it("renders Image when url present", () => {
    (useQuery as unknown as Mock).mockReturnValue({
      data: {
        url: "https://test-store.public.blob.vercel-storage.com/abcdef0123456789abcdef0123456789/32x32.webp",
      },
      isPending: false,
      isPlaceholderData: false,
    });
    render(<Favicon domain="example.com" size={16} />);
    const img = screen.getByRole("img", { name: /icon/i });
    expect(img).toHaveAttribute(
      "src",
      "https://test-store.public.blob.vercel-storage.com/abcdef0123456789abcdef0123456789/32x32.webp",
    );
  });
});

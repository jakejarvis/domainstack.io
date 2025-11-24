/* @vitest-environment jsdom */
import { render, screen } from "@testing-library/react";
import { createElement } from "react";
import type { Mock } from "vitest";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
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

describe("Screenshot", () => {
  beforeEach(() => {
    (useQuery as unknown as Mock).mockReset();
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("shows loading UI during fetch", () => {
    (useQuery as unknown as Mock).mockReturnValue({
      data: undefined,
      isLoading: true,
      isFetching: false,
    });
    render(<Screenshot domain="example.com" />);
    expect(screen.getByText(/taking screenshot/i)).toBeInTheDocument();
  });

  it("renders image when url present", () => {
    (useQuery as unknown as Mock).mockReturnValue({
      data: {
        url: "https://test-store.public.blob.vercel-storage.com/abcdef0123456789abcdef0123456789/1200x630.webp",
      },
      isLoading: false,
      isFetching: false,
    });
    render(<Screenshot domain="example.com" />);
    const img = screen.getByRole("img", {
      name: /homepage preview of example.com/i,
    });
    expect(img).toHaveAttribute(
      "src",
      "https://test-store.public.blob.vercel-storage.com/abcdef0123456789abcdef0123456789/1200x630.webp",
    );
  });

  it("shows fallback when no url and not loading", () => {
    (useQuery as unknown as Mock).mockReturnValue({
      data: { url: null },
      isLoading: false,
      isFetching: false,
    });
    render(<Screenshot domain="example.com" />);
    expect(screen.getByText(/unable to take/i)).toBeInTheDocument();
  });
});

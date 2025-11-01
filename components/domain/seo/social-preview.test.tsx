/* @vitest-environment jsdom */
import { render, screen } from "@testing-library/react";
import { createElement } from "react";
import { describe, expect, it, vi } from "vitest";
import { SocialPreview } from "./social-preview";

// Mock next/image with a plain img for JSDOM
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

describe("SocialPreview", () => {
  it("renders Twitter compact card with title, description, image", () => {
    render(
      <SocialPreview
        provider="twitter"
        variant="compact"
        title="Example Title"
        description="Example description"
        image="https://cdn.example.com/og.png"
        url="https://www.example.com/post"
      />,
    );

    // Hostname should be truncated without www
    expect(screen.getByText("example.com")).toBeInTheDocument();
    // Title and description appear
    expect(screen.getByText("Example Title")).toBeInTheDocument();
    expect(screen.getByText("Example description")).toBeInTheDocument();
    // Image is rendered via mocked next/image
    const img = screen.getByRole("img", { name: /preview image/i });
    expect(img).toHaveAttribute("src", "https://cdn.example.com/og.png");
  });

  it("renders Twitter large card with fallback when no image", () => {
    render(
      <SocialPreview
        provider="twitter"
        variant="large"
        title="Large Title"
        description="Large description"
        image={null}
        url="https://example.com/article"
      />,
    );

    // Shows fallback text for missing image
    expect(screen.getByText(/no image/i)).toBeInTheDocument();
    // Title still shown
    expect(screen.getByText("Large Title")).toBeInTheDocument();
  });

  it("renders Facebook card and anchors to the provided url", () => {
    render(
      <SocialPreview
        provider="facebook"
        title="FB Title"
        description="FB description"
        image="https://cdn.example.com/fb.png"
        url="https://facebook.example.com/page"
      />,
    );

    // The card is wrapped in a link
    const link = screen.getByRole("link", {
      name: /open facebook\.example\.com in a new tab/i,
    });
    expect(link).toHaveAttribute("href", "https://facebook.example.com/page");

    // Basic content assertions
    expect(screen.getByText("FB Title")).toBeInTheDocument();
    const img = screen.getByRole("img", { name: /preview image/i });
    expect(img).toHaveAttribute("src", "https://cdn.example.com/fb.png");
  });
});


import { describe, expect, it, vi } from "vitest";
import type { SeoResponse } from "@/lib/schemas";
import { render, screen } from "@/lib/test-utils";

// Mock child components to isolate main component testing
vi.mock("@/components/domain/seo/meta-tags-grid", () => ({
  MetaTagsGrid: () => <div data-testid="meta-tags-grid" />,
}));

vi.mock("@/components/domain/seo/social-preview-tabs", () => ({
  SocialPreviewTabs: ({ twitterVariant }: { twitterVariant: string }) => (
    <div data-testid="social-preview-tabs" data-variant={twitterVariant} />
  ),
}));

vi.mock("@/components/domain/seo/robots-summary", () => ({
  RobotsSummary: () => <div data-testid="robots-summary" />,
}));

import { SeoSection } from "./seo-section";

/**
 * Test fixture builder for SeoResponse objects.
 */
function buildSeoResponse(overrides: Partial<SeoResponse> = {}): SeoResponse {
  return {
    meta: {
      openGraph: {},
      twitter: {},
      general: {},
    },
    robots: null,
    preview: null,
    source: {
      finalUrl: null,
      status: null,
    },
    errors: undefined,
    ...overrides,
  };
}

describe("SeoSection - Integration & Orchestration", () => {
  describe("component orchestration", () => {
    it("renders all child components when data is present", () => {
      const data = buildSeoResponse({
        meta: {
          openGraph: {},
          twitter: {},
          general: { robots: "index, follow" },
        },
        preview: {
          title: "Test",
          description: "Test",
          image: null,
          imageUploaded: null,
          canonicalUrl: "https://example.com",
        },
      });
      render(<SeoSection domain="example.com" data={data} />);

      expect(screen.getByTestId("meta-tags-grid")).toBeInTheDocument();
      expect(screen.getByTestId("social-preview-tabs")).toBeInTheDocument();
      expect(screen.getByTestId("robots-summary")).toBeInTheDocument();
    });

    it("shows empty state when no meta tags", () => {
      const data = buildSeoResponse();
      render(<SeoSection domain="example.com" data={data} />);
      expect(screen.getByText(/No SEO meta detected/i)).toBeInTheDocument();
      expect(screen.queryByTestId("meta-tags-grid")).not.toBeInTheDocument();
    });

    it("does not render social preview tabs when preview is null", () => {
      const data = buildSeoResponse({
        meta: {
          openGraph: {},
          twitter: {},
          general: { robots: "index, follow" },
        },
        preview: null,
      });
      render(<SeoSection domain="example.com" data={data} />);

      expect(screen.getByTestId("meta-tags-grid")).toBeInTheDocument();
      expect(
        screen.queryByTestId("social-preview-tabs"),
      ).not.toBeInTheDocument();
      expect(screen.getByTestId("robots-summary")).toBeInTheDocument();
    });
  });

  describe("Twitter variant selection", () => {
    it("selects large variant for summary_large_image card", () => {
      const data = buildSeoResponse({
        meta: {
          openGraph: {},
          twitter: { card: "summary_large_image" },
          general: {},
        },
        preview: {
          title: "Test",
          description: "Test",
          image: "https://example.com/image.png",
          imageUploaded: null,
          canonicalUrl: "https://example.com",
        },
      });
      render(<SeoSection domain="example.com" data={data} />);
      const tabs = screen.getByTestId("social-preview-tabs");
      expect(tabs).toHaveAttribute("data-variant", "large");
    });

    it("selects compact variant for summary card", () => {
      const data = buildSeoResponse({
        meta: {
          openGraph: {},
          twitter: { card: "summary" },
          general: {},
        },
        preview: {
          title: "Test",
          description: "Test",
          image: null,
          imageUploaded: null,
          canonicalUrl: "https://example.com",
        },
      });
      render(<SeoSection domain="example.com" data={data} />);
      const tabs = screen.getByTestId("social-preview-tabs");
      expect(tabs).toHaveAttribute("data-variant", "compact");
    });

    it("defaults to large variant when image present but no twitter card", () => {
      const data = buildSeoResponse({
        meta: {
          openGraph: {},
          twitter: {},
          general: {},
        },
        preview: {
          title: "Test",
          description: "Test",
          image: "https://example.com/image.png",
          imageUploaded: null,
          canonicalUrl: "https://example.com",
        },
      });
      render(<SeoSection domain="example.com" data={data} />);
      const tabs = screen.getByTestId("social-preview-tabs");
      expect(tabs).toHaveAttribute("data-variant", "large");
    });

    it("defaults to compact variant when no image and no twitter card", () => {
      const data = buildSeoResponse({
        meta: {
          openGraph: {},
          twitter: {},
          general: {},
        },
        preview: {
          title: "Test",
          description: "Test",
          image: null,
          imageUploaded: null,
          canonicalUrl: "https://example.com",
        },
      });
      render(<SeoSection domain="example.com" data={data} />);
      const tabs = screen.getByTestId("social-preview-tabs");
      expect(tabs).toHaveAttribute("data-variant", "compact");
    });
  });

  describe("redirect alert integration", () => {
    it("shows alert when domain redirects to different domain", () => {
      const data = buildSeoResponse({
        meta: {
          openGraph: {},
          twitter: {},
          general: {},
        },
        preview: {
          title: "Test",
          description: "Test",
          image: null,
          imageUploaded: null,
          canonicalUrl: "https://redirected.com",
        },
        source: {
          finalUrl: "https://redirected.com",
          status: 301,
        },
      });
      render(<SeoSection domain="example.com" data={data} />);
      expect(screen.getByText(/We followed a redirect/i)).toBeInTheDocument();
    });

    it("does not show alert when no redirect occurred", () => {
      const data = buildSeoResponse({
        meta: {
          openGraph: {},
          twitter: {},
          general: {},
        },
        preview: {
          title: "Test",
          description: "Test",
          image: null,
          imageUploaded: null,
          canonicalUrl: "https://example.com",
        },
        source: {
          finalUrl: "https://example.com",
          status: 200,
        },
      });
      render(<SeoSection domain="example.com" data={data} />);
      expect(
        screen.queryByText(/We followed a redirect/i),
      ).not.toBeInTheDocument();
    });
  });
});

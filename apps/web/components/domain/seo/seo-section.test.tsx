import { describe, expect, it, vi } from "vitest";
import { page } from "vitest/browser";

import { render } from "@/mocks/react";
import type { SeoResponse } from "@domainstack/types";

// Mock child components to isolate main component testing
vi.mock("@/components/domain/seo/meta-tags-grid", () => ({
  MetaTagsGrid: () => <div data-testid="meta-tags-grid" />,
}));

vi.mock("@/components/domain/seo/social-previews", () => ({
  SocialPreviews: ({ twitterVariant }: { twitterVariant: string }) => (
    <div data-testid="social-previews" data-variant={twitterVariant} />
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
    it("renders all child components when data is present", async () => {
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
          canonicalUrl: "https://test.invalid",
        },
        robots: {
          fetched: true,
          groups: [
            {
              userAgents: ["*"],
              rules: [{ type: "disallow", value: "/admin" }],
            },
          ],
          sitemaps: ["https://test.invalid/sitemap.xml"],
        },
      });
      await render(<SeoSection domain="test.invalid" data={data} />);

      await expect.element(page.getByTestId("meta-tags-grid")).toBeInTheDocument();
      await expect.element(page.getByTestId("social-previews")).toBeInTheDocument();
      await expect.element(page.getByTestId("robots-summary")).toBeInTheDocument();
    });

    it("shows empty state when no meta tags", async () => {
      const data = buildSeoResponse();
      await render(<SeoSection domain="test.invalid" data={data} />);
      await expect.element(page.getByText(/No SEO meta detected/i)).toBeInTheDocument();
      await expect.element(page.getByTestId("meta-tags-grid")).not.toBeInTheDocument();
    });

    it("does not render social preview tabs when preview is null", async () => {
      const data = buildSeoResponse({
        meta: {
          openGraph: {},
          twitter: {},
          general: { robots: "index, follow" },
        },
        preview: null,
        robots: {
          fetched: true,
          groups: [
            {
              userAgents: ["*"],
              rules: [{ type: "disallow", value: "/admin" }],
            },
          ],
          sitemaps: [],
        },
      });
      await render(<SeoSection domain="test.invalid" data={data} />);

      await expect.element(page.getByTestId("meta-tags-grid")).toBeInTheDocument();
      await expect.element(page.getByTestId("social-previews")).not.toBeInTheDocument();
      await expect.element(page.getByTestId("robots-summary")).toBeInTheDocument();
    });
  });

  describe("Twitter variant selection", () => {
    it("selects large variant for summary_large_image card", async () => {
      const data = buildSeoResponse({
        meta: {
          openGraph: {},
          twitter: { card: "summary_large_image" },
          general: {},
        },
        preview: {
          title: "Test",
          description: "Test",
          image: "https://test.invalid/image.png",
          imageUploaded: null,
          canonicalUrl: "https://test.invalid",
        },
      });
      await render(<SeoSection domain="test.invalid" data={data} />);
      await expect
        .element(page.getByTestId("social-previews"))
        .toHaveAttribute("data-variant", "large");
    });

    it("selects compact variant for summary card", async () => {
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
          canonicalUrl: "https://test.invalid",
        },
      });
      await render(<SeoSection domain="test.invalid" data={data} />);
      await expect
        .element(page.getByTestId("social-previews"))
        .toHaveAttribute("data-variant", "compact");
    });

    it("defaults to large variant when image present but no twitter card", async () => {
      const data = buildSeoResponse({
        meta: {
          openGraph: {},
          twitter: {},
          general: {},
        },
        preview: {
          title: "Test",
          description: "Test",
          image: "https://test.invalid/image.png",
          imageUploaded: null,
          canonicalUrl: "https://test.invalid",
        },
      });
      await render(<SeoSection domain="test.invalid" data={data} />);
      await expect
        .element(page.getByTestId("social-previews"))
        .toHaveAttribute("data-variant", "large");
    });

    it("defaults to compact variant when no image and no twitter card", async () => {
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
          canonicalUrl: "https://test.invalid",
        },
      });
      await render(<SeoSection domain="test.invalid" data={data} />);
      await expect
        .element(page.getByTestId("social-previews"))
        .toHaveAttribute("data-variant", "compact");
    });
  });

  describe("redirect alert integration", () => {
    it("shows alert when domain redirects to different domain", async () => {
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
      await render(<SeoSection domain="test.invalid" data={data} />);
      await expect.element(page.getByText(/We followed a redirect/i)).toBeInTheDocument();
    });

    it("does not show alert when no redirect occurred", async () => {
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
          canonicalUrl: "https://test.invalid",
        },
        source: {
          finalUrl: "https://test.invalid",
          status: 200,
        },
      });
      await render(<SeoSection domain="test.invalid" data={data} />);
      await expect.element(page.getByText(/We followed a redirect/i)).not.toBeInTheDocument();
    });
  });
});

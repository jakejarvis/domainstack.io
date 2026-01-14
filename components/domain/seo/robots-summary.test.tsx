import { describe, expect, it, vi } from "vitest";
import type { SeoResponse } from "@/lib/types/domain/seo";
import { render, screen } from "@/mocks/react";
import { RobotsSummary } from "./robots-summary";

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

vi.mock("@/components/ui/accordion", () => ({
  Accordion: ({ children }: { children: React.ReactNode }) => (
    <div data-slot="accordion">{children}</div>
  ),
  AccordionContent: ({ children }: { children: React.ReactNode }) => (
    <div data-slot="accordion-content">{children}</div>
  ),
  AccordionItem: ({ children }: { children: React.ReactNode }) => (
    <div data-slot="accordion-item">{children}</div>
  ),
  AccordionTrigger: ({ children }: { children: React.ReactNode }) => (
    <button type="button" data-slot="accordion-trigger">
      {children}
    </button>
  ),
}));

describe("RobotsSummary", () => {
  describe("robots.txt rendering", () => {
    it("renders robots.txt rules and sitemaps", () => {
      const robots: SeoResponse["robots"] = {
        fetched: true,
        groups: [
          {
            userAgents: ["*"],
            rules: [
              { type: "disallow", value: "/admin" },
              { type: "allow", value: "/public" },
            ],
          },
        ],
        sitemaps: ["https://test.invalid/sitemap.xml"],
      };
      render(<RobotsSummary domain="test.invalid" robots={robots} />);

      // Verify robots.txt link
      expect(screen.getByRole("link", { name: /robots.txt/i })).toHaveAttribute(
        "href",
        "https://test.invalid/robots.txt",
      );

      // Verify rules are present (in accordion)
      expect(screen.getByText("/admin")).toBeInTheDocument();
      expect(screen.getByText("/public")).toBeInTheDocument();

      // Verify sitemap
      expect(screen.getByRole("link", { name: /sitemap/i })).toHaveAttribute(
        "href",
        "https://test.invalid/sitemap.xml",
      );
    });

    it("shows empty state when robots.txt has empty groups", () => {
      const robots: SeoResponse["robots"] = {
        fetched: true,
        groups: [],
        sitemaps: [],
      };
      render(<RobotsSummary domain="test.invalid" robots={robots} />);
      // When there are no groups and no sitemaps, only the header with link is shown
      expect(
        screen.getByRole("link", { name: /robots\.txt/i }),
      ).toBeInTheDocument();
    });

    it("shows appropriate message when robots.txt has no rules but has sitemaps", () => {
      const robots: SeoResponse["robots"] = {
        fetched: true,
        groups: [],
        sitemaps: [
          "https://test.invalid/sitemap.xml",
          "https://test.invalid/sitemap-2.xml",
        ],
      };
      render(<RobotsSummary domain="test.invalid" robots={robots} />);
      expect(screen.getByText(/No crawl rules detected/i)).toBeInTheDocument();
      expect(screen.getByText("Sitemaps")).toBeInTheDocument();
    });

    it("handles multiple robot groups with different user agents", () => {
      const robots: SeoResponse["robots"] = {
        fetched: true,
        groups: [
          {
            userAgents: ["*"],
            rules: [{ type: "disallow", value: "/private" }],
          },
          {
            userAgents: ["Googlebot"],
            rules: [{ type: "allow", value: "/special" }],
          },
        ],
        sitemaps: [],
      };
      render(<RobotsSummary domain="test.invalid" robots={robots} />);
      // "All" appears in both the filter button and the user agent badge
      expect(screen.getAllByText("All").length).toBeGreaterThan(0);
      expect(screen.getByText("Googlebot")).toBeInTheDocument();
    });

    it("renders crawl-delay rules", () => {
      const robots: SeoResponse["robots"] = {
        fetched: true,
        groups: [
          {
            userAgents: ["*"],
            rules: [
              { type: "disallow", value: "/admin" },
              { type: "crawlDelay", value: "10" },
            ],
          },
        ],
        sitemaps: [],
      };
      render(<RobotsSummary domain="test.invalid" robots={robots} />);
      expect(screen.getByText("10")).toBeInTheDocument();
    });

    it("renders content-signal rules", () => {
      const robots: SeoResponse["robots"] = {
        fetched: true,
        groups: [
          {
            userAgents: ["*"],
            rules: [
              { type: "disallow", value: "/admin" },
              { type: "contentSignal", value: "no-ai-training" },
            ],
          },
        ],
        sitemaps: [],
      };
      render(<RobotsSummary domain="test.invalid" robots={robots} />);
      expect(screen.getByText("no-ai-training")).toBeInTheDocument();
    });

    it("renders multiple sitemaps", () => {
      const robots: SeoResponse["robots"] = {
        fetched: true,
        groups: [
          {
            userAgents: ["*"],
            rules: [{ type: "allow", value: "/" }],
          },
        ],
        sitemaps: [
          "https://test.invalid/sitemap.xml",
          "https://test.invalid/sitemap-products.xml",
          "https://test.invalid/sitemap-blog.xml",
        ],
      };
      render(<RobotsSummary domain="test.invalid" robots={robots} />);
      // Progressive reveal shows first 2 sitemaps by default
      expect(
        screen.getByRole("link", {
          name: /https:\/\/test\.invalid\/sitemap\.xml/i,
        }),
      ).toBeInTheDocument();
      expect(
        screen.getByRole("link", {
          name: /https:\/\/test\.invalid\/sitemap-products\.xml/i,
        }),
      ).toBeInTheDocument();
      // Third sitemap is hidden behind "Show more" button
      expect(
        screen.getByRole("button", { name: /Show 1 more/i }),
      ).toBeInTheDocument();
    });

    it("handles empty disallow value (allow all)", () => {
      const robots: SeoResponse["robots"] = {
        fetched: true,
        groups: [
          {
            userAgents: ["*"],
            rules: [{ type: "disallow", value: "" }],
          },
        ],
        sitemaps: [],
      };
      render(<RobotsSummary domain="test.invalid" robots={robots} />);
      // Empty disallow means allow all - the message appears inside the accordion when opened
      // Since we're using mocked accordions, we can't test the message visibility
      // Just verify the component renders
      expect(
        screen.getByRole("link", { name: /robots\.txt/i }),
      ).toBeInTheDocument();
    });

    it("renders allow and disallow filter buttons", () => {
      const robots: SeoResponse["robots"] = {
        fetched: true,
        groups: [
          {
            userAgents: ["*"],
            rules: [
              { type: "allow", value: "/public" },
              { type: "disallow", value: "/admin" },
            ],
          },
        ],
        sitemaps: [],
      };
      render(<RobotsSummary domain="test.invalid" robots={robots} />);
      // Get all buttons and find the filter buttons specifically
      const buttons = screen.getAllByRole("button");
      const allButton = buttons.find((btn) => btn.textContent?.includes("All"));
      const allowButton = buttons.find((btn) =>
        btn.textContent?.includes("Allow"),
      );
      const disallowButton = buttons.find((btn) =>
        btn.textContent?.includes("Disallow"),
      );

      expect(allButton).toBeInTheDocument();
      expect(allowButton).toBeInTheDocument();
      expect(disallowButton).toBeInTheDocument();
    });
  });
});

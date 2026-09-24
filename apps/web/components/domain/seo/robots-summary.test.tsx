import { describe, expect, it, vi } from "vitest";
import { page } from "vitest/browser";

import { render } from "@/mocks/react";
import type { SeoResponse } from "@domainstack/types";

import { RobotsSummary } from "./robots-summary";

vi.mock("@domainstack/ui/tooltip", () => ({
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

describe("RobotsSummary", () => {
  describe("robots.txt rendering", () => {
    it("renders robots.txt rules and sitemaps", async () => {
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
      await render(<RobotsSummary domain="test.invalid" robots={robots} />);

      // Verify robots.txt link
      await expect
        .element(page.getByRole("link", { name: /robots.txt/i }))
        .toHaveAttribute("href", "https://test.invalid/robots.txt");

      // Verify rules are present (in accordion)
      await expect.element(page.getByText("/admin", { exact: true })).toBeInTheDocument();
      await expect.element(page.getByText("/public", { exact: true })).toBeInTheDocument();

      // Verify sitemap
      await expect
        .element(page.getByRole("link", { name: /sitemap/i }))
        .toHaveAttribute("href", "https://test.invalid/sitemap.xml");
    });

    it("shows empty state when robots.txt has empty groups", async () => {
      const robots: SeoResponse["robots"] = {
        fetched: true,
        groups: [],
        sitemaps: [],
      };
      await render(<RobotsSummary domain="test.invalid" robots={robots} />);
      // When there are no groups and no sitemaps, only the header with link is shown
      await expect.element(page.getByRole("link", { name: /robots\.txt/i })).toBeInTheDocument();
    });

    it("shows appropriate message when robots.txt has no rules but has sitemaps", async () => {
      const robots: SeoResponse["robots"] = {
        fetched: true,
        groups: [],
        sitemaps: ["https://test.invalid/sitemap.xml", "https://test.invalid/sitemap-2.xml"],
      };
      await render(<RobotsSummary domain="test.invalid" robots={robots} />);
      await expect.element(page.getByText(/No crawl rules detected/i)).toBeInTheDocument();
      await expect.element(page.getByText("Sitemaps", { exact: true })).toBeInTheDocument();
    });

    it("handles multiple robot groups with different user agents", async () => {
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
      await render(<RobotsSummary domain="test.invalid" robots={robots} />);
      // "All" appears in both the filter button and the user agent badge
      expect(page.getByText("All", { exact: true }).length).toBeGreaterThan(0);
      await expect.element(page.getByText("Googlebot", { exact: true })).toBeInTheDocument();
    });

    it("renders crawl-delay rules", async () => {
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
      await render(<RobotsSummary domain="test.invalid" robots={robots} />);
      await expect.element(page.getByText("10", { exact: true })).toBeInTheDocument();
    });

    it("renders groups that only have crawl-delay rules", async () => {
      const robots: SeoResponse["robots"] = {
        fetched: true,
        groups: [{ userAgents: ["*"], rules: [{ type: "crawlDelay", value: "10" }] }],
        sitemaps: ["https://test.invalid/sitemap.xml"],
      };
      await render(<RobotsSummary domain="test.invalid" robots={robots} />);
      await expect.element(page.getByText("10", { exact: true })).toBeInTheDocument();
      await expect.element(page.getByText(/No crawl rules detected/i)).not.toBeInTheDocument();
      // No allow/disallow rules to filter, so the filter controls are hidden
      await expect
        .element(page.getByRole("textbox", { name: "Filter robots rules" }))
        .not.toBeInTheDocument();
    });

    it("offers a reset when the filter matches nothing", async () => {
      const robots: SeoResponse["robots"] = {
        fetched: true,
        groups: [{ userAgents: ["*"], rules: [{ type: "disallow", value: "/admin" }] }],
        sitemaps: [],
      };
      await render(<RobotsSummary domain="test.invalid" robots={robots} />);
      await page.getByRole("textbox", { name: "Filter robots rules" }).fill("nomatch");
      // The message shares its element with the reset button, so match by substring.
      await expect.element(page.getByText(/No matching rules/)).toBeInTheDocument();

      await page.getByRole("button", { name: "Reset filters" }).click();
      await expect.element(page.getByText("/admin", { exact: true })).toBeInTheDocument();
      await expect
        .element(page.getByRole("textbox", { name: "Filter robots rules" }))
        .toHaveValue("");
    });

    it("renders content-signal rules", async () => {
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
      await render(<RobotsSummary domain="test.invalid" robots={robots} />);
      await expect.element(page.getByText("no-ai-training", { exact: true })).toBeInTheDocument();
    });

    it("renders multiple sitemaps", async () => {
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
      await render(<RobotsSummary domain="test.invalid" robots={robots} />);
      // Progressive reveal shows first 2 sitemaps by default
      await expect
        .element(
          page.getByRole("link", {
            name: /https:\/\/test\.invalid\/sitemap\.xml/i,
          }),
        )
        .toBeInTheDocument();
      await expect
        .element(
          page.getByRole("link", {
            name: /https:\/\/test\.invalid\/sitemap-products\.xml/i,
          }),
        )
        .toBeInTheDocument();
      // Third sitemap is hidden behind "Show more" button
      await expect.element(page.getByRole("button", { name: /Show 1 more/i })).toBeInTheDocument();
    });

    it("handles empty disallow value (allow all)", async () => {
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
      await render(<RobotsSummary domain="test.invalid" robots={robots} />);
      // Empty disallow means allow all; the "*" group is open by default
      await expect
        .element(page.getByText("No disallow restrictions (allow all)", { exact: true }))
        .toBeVisible();
    });

    it("lists All bots first when grouped with other user agents", async () => {
      const robots: SeoResponse["robots"] = {
        fetched: true,
        groups: [
          {
            userAgents: ["AI2Bot", "GPTBot", "*"],
            rules: [{ type: "disallow", value: "/admin" }],
          },
        ],
        sitemaps: [],
      };
      await render(<RobotsSummary domain="test.invalid" robots={robots} />);

      const allBots = page.getByText("All bots", { exact: true }).elements()[0];
      const firstNamed = page.getByText("AI2Bot", { exact: true }).elements()[0];
      expect(allBots.compareDocumentPosition(firstNamed) & Node.DOCUMENT_POSITION_FOLLOWING).toBe(
        Node.DOCUMENT_POSITION_FOLLOWING,
      );
    });

    it("renders allow and disallow filter buttons", async () => {
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
      await render(<RobotsSummary domain="test.invalid" robots={robots} />);
      // Get all buttons and find the filter buttons specifically
      const buttons = page.getByRole("button").elements();
      const allButton = buttons.find((btn) => btn.textContent?.includes("All"));
      const allowButton = buttons.find((btn) => btn.textContent?.includes("Allow"));
      const disallowButton = buttons.find((btn) => btn.textContent?.includes("Disallow"));

      expect(allButton).toBeDefined();
      expect(allowButton).toBeDefined();
      expect(disallowButton).toBeDefined();
    });
  });

  describe("accordion", () => {
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
        { userAgents: ["Googlebot"], rules: [{ type: "disallow", value: "/private" }] },
        { userAgents: ["Bingbot"], rules: [{ type: "allow", value: "/bing" }] },
      ],
      sitemaps: [],
    };

    it("opens the All bots group by default", async () => {
      await render(<RobotsSummary domain="test.invalid" robots={robots} />);

      await expect.element(page.getByText("/public", { exact: true })).toBeVisible();
      await expect.element(page.getByText("/bing", { exact: true })).not.toBeVisible();
    });

    it("keeps the same group open when a filter hides the groups before it", async () => {
      await render(<RobotsSummary domain="test.invalid" robots={robots} />);

      await page.getByRole("button", { name: /Bingbot/ }).click();
      await expect.element(page.getByText("/bing", { exact: true })).toBeVisible();

      // Googlebot has no allow rules, so this drops it and shifts Bingbot up a position.
      await page.getByRole("button", { name: /^Allow/ }).click();
      await expect.element(page.getByRole("button", { name: /Googlebot/ })).not.toBeInTheDocument();

      await expect.element(page.getByText("/bing", { exact: true })).toBeVisible();
      await expect.element(page.getByText("/public", { exact: true })).not.toBeVisible();
    });

    it("opens every matching group while searching", async () => {
      await render(<RobotsSummary domain="test.invalid" robots={robots} />);

      await page.getByRole("textbox", { name: "Filter robots rules" }).fill("/");

      await expect.element(page.getByText("/public", { exact: true })).toBeVisible();
      await expect.element(page.getByText("/private", { exact: true })).toBeVisible();
      await expect.element(page.getByText("/bing", { exact: true })).toBeVisible();
    });
  });
});

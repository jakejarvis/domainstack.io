import { describe, expect, it } from "vitest";
import { page } from "vitest/browser";

import { render } from "@/mocks/react";

import { MetaTagsGrid } from "./meta-tags-grid";

describe("MetaTagsGrid", () => {
  describe("basic rendering", () => {
    it("renders all provided meta tags", async () => {
      const metaTagValues = [
        { label: "Title", value: "Test Title" },
        { label: "Description", value: "Test Description" },
        { label: "Keywords", value: "seo, testing" },
        { label: "Author", value: "Test Author" },
        { label: "Canonical", value: "https://test.invalid/canonical" },
        { label: "Image", value: "https://test.invalid/image.png" },
        { label: "Generator", value: "Next.js" },
        { label: "Robots", value: "index, follow" },
      ];
      await render(<MetaTagsGrid metaTagValues={metaTagValues} />);

      // Use getAllByText for elements that appear multiple times (label + value)
      expect(page.getByText("Test Title", { exact: true }).length).toBeGreaterThan(0);
      expect(page.getByText("Test Description", { exact: true }).length).toBeGreaterThan(0);
      expect(page.getByText("seo, testing", { exact: true }).length).toBeGreaterThan(0);
      expect(page.getByText("Test Author", { exact: true }).length).toBeGreaterThan(0);
      expect(page.getByText("Next.js", { exact: true }).length).toBeGreaterThan(0);
      expect(page.getByText("index, follow", { exact: true }).length).toBeGreaterThan(0);
    });

    it("filters out null and undefined values", async () => {
      const metaTagValues = [
        { label: "Title", value: "Test Title" },
        { label: "Description", value: null },
        { label: "Keywords", value: undefined },
        { label: "Author", value: "Test Author" },
      ];
      await render(<MetaTagsGrid metaTagValues={metaTagValues} />);

      expect(page.getByText("Test Title", { exact: true }).length).toBeGreaterThan(0);
      expect(page.getByText("Test Author", { exact: true }).length).toBeGreaterThan(0);
      await expect.element(page.getByText("Description", { exact: true })).not.toBeInTheDocument();
      await expect.element(page.getByText("Keywords", { exact: true })).not.toBeInTheDocument();
    });

    it("displays correct count in subhead", async () => {
      const metaTagValues = [
        { label: "Title", value: "Test Title" },
        { label: "Description", value: "Test Description" },
        { label: "Keywords", value: null },
      ];
      await render(<MetaTagsGrid metaTagValues={metaTagValues} />);

      // Should show count of 2 (only non-null values)
      await expect.element(page.getByText("Meta Tags", { exact: true })).toBeInTheDocument();
      // Count badge with "2" should be present
      await expect.element(page.getByText("2", { exact: true })).toBeInTheDocument();
    });

    it("renders external link for URL values", async () => {
      const metaTagValues = [
        { label: "Canonical", value: "https://test.invalid/page" },
        { label: "Image", value: "https://test.invalid/og-image.png" },
      ];
      await render(<MetaTagsGrid metaTagValues={metaTagValues} />);

      const links = page.getByRole("link").elements();
      expect(links.length).toBeGreaterThan(0);

      const canonicalLink = links.find((link) =>
        link.getAttribute("href")?.includes("test.invalid/page"),
      );
      expect(canonicalLink).toBeDefined();
      await expect.element(page.elementLocator(canonicalLink!)).toHaveAttribute("target", "_blank");
      await expect.element(page.elementLocator(canonicalLink!)).toHaveAttribute("rel", "noopener");
    });

    it("does not render external link for non-URL values", async () => {
      const metaTagValues = [
        { label: "Title", value: "Just a title" },
        { label: "Author", value: "John Doe" },
      ];
      await render(<MetaTagsGrid metaTagValues={metaTagValues} />);

      // Should have no external links for these values
      const links = page.getByRole("link").elements();
      // Filter out any links that might be from external link icons
      const valueLinks = links.filter(
        (link) =>
          link.textContent?.includes("Just a title") || link.textContent?.includes("John Doe"),
      );
      expect(valueLinks.length).toBe(0);
    });
  });

  describe("parameterized meta tag combinations", () => {
    const testCases: Array<{
      name: string;
      metaTagValues: { label: string; value?: string | null }[];
      expectedTags: string[];
      expectedCount: number;
    }> = [
      {
        name: "minimal meta tags",
        metaTagValues: [
          { label: "Title", value: "Minimal Title" },
          { label: "Description", value: null },
          { label: "Keywords", value: null },
        ],
        expectedTags: ["Minimal Title"],
        expectedCount: 1,
      },
      {
        name: "complete meta tags",
        metaTagValues: [
          { label: "Title", value: "Complete Title" },
          { label: "Description", value: "Complete Description" },
          { label: "Keywords", value: "test, seo" },
          { label: "Author", value: "Test Author" },
          { label: "Generator", value: "Next.js" },
          { label: "Robots", value: "index, follow" },
        ],
        expectedTags: [
          "Complete Title",
          "Complete Description",
          "test, seo",
          "Test Author",
          "Next.js",
          "index, follow",
        ],
        expectedCount: 6,
      },
      {
        name: "only keywords and author",
        metaTagValues: [
          { label: "Title", value: null },
          { label: "Description", value: null },
          { label: "Keywords", value: "keyword1, keyword2" },
          { label: "Author", value: "John Doe" },
        ],
        expectedTags: ["keyword1, keyword2", "John Doe"],
        expectedCount: 2,
      },
      {
        name: "only canonical URL",
        metaTagValues: [
          { label: "Title", value: null },
          { label: "Description", value: null },
          { label: "Canonical", value: "https://test.invalid/page" },
        ],
        expectedTags: ["https://test.invalid/page"],
        expectedCount: 1,
      },
    ];

    for (const testCase of testCases) {
      it(`renders ${testCase.name}`, async () => {
        await render(<MetaTagsGrid metaTagValues={testCase.metaTagValues} />);

        // Verify count
        await expect
          .element(page.getByText(testCase.expectedCount.toString(), { exact: true }))
          .toBeInTheDocument();

        // Use getAllByText to handle elements that appear in multiple places
        for (const expectedTag of testCase.expectedTags) {
          expect(page.getByText(expectedTag, { exact: true }).length).toBeGreaterThan(0);
        }
      });
    }
  });
});

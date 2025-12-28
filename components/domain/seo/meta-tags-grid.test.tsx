import { describe, expect, it } from "vitest";
import { render, screen } from "@/lib/test-utils";
import { MetaTagsGrid } from "./meta-tags-grid";

describe("MetaTagsGrid", () => {
  describe("basic rendering", () => {
    it("renders all provided meta tags", () => {
      const metaTagValues = [
        { label: "Title", value: "Test Title" },
        { label: "Description", value: "Test Description" },
        { label: "Keywords", value: "seo, testing" },
        { label: "Author", value: "Test Author" },
        { label: "Canonical", value: "https://example.com/canonical" },
        { label: "Image", value: "https://example.com/image.png" },
        { label: "Generator", value: "Next.js" },
        { label: "Robots", value: "index, follow" },
      ];
      render(<MetaTagsGrid metaTagValues={metaTagValues} />);

      // Use getAllByText for elements that appear multiple times (label + value)
      expect(screen.getAllByText("Test Title").length).toBeGreaterThan(0);
      expect(screen.getAllByText("Test Description").length).toBeGreaterThan(0);
      expect(screen.getAllByText("seo, testing").length).toBeGreaterThan(0);
      expect(screen.getAllByText("Test Author").length).toBeGreaterThan(0);
      expect(screen.getAllByText("Next.js").length).toBeGreaterThan(0);
      expect(screen.getAllByText("index, follow").length).toBeGreaterThan(0);
    });

    it("filters out null and undefined values", () => {
      const metaTagValues = [
        { label: "Title", value: "Test Title" },
        { label: "Description", value: null },
        { label: "Keywords", value: undefined },
        { label: "Author", value: "Test Author" },
      ];
      render(<MetaTagsGrid metaTagValues={metaTagValues} />);

      expect(screen.getAllByText("Test Title").length).toBeGreaterThan(0);
      expect(screen.getAllByText("Test Author").length).toBeGreaterThan(0);
      expect(screen.queryByText("Description")).not.toBeInTheDocument();
      expect(screen.queryByText("Keywords")).not.toBeInTheDocument();
    });

    it("displays correct count in subhead", () => {
      const metaTagValues = [
        { label: "Title", value: "Test Title" },
        { label: "Description", value: "Test Description" },
        { label: "Keywords", value: null },
      ];
      render(<MetaTagsGrid metaTagValues={metaTagValues} />);

      // Should show count of 2 (only non-null values)
      expect(screen.getByText("Meta Tags")).toBeInTheDocument();
      // Count badge with "2" should be present
      expect(screen.getByText("2")).toBeInTheDocument();
    });

    it("renders external link for URL values", () => {
      const metaTagValues = [
        { label: "Canonical", value: "https://example.com/page" },
        { label: "Image", value: "https://example.com/og-image.png" },
      ];
      render(<MetaTagsGrid metaTagValues={metaTagValues} />);

      const links = screen.getAllByRole("link");
      expect(links.length).toBeGreaterThan(0);

      const canonicalLink = links.find((link) =>
        link.getAttribute("href")?.includes("example.com/page"),
      );
      expect(canonicalLink).toBeDefined();
      expect(canonicalLink).toHaveAttribute("target", "_blank");
      expect(canonicalLink).toHaveAttribute("rel", "noopener");
    });

    it("does not render external link for non-URL values", () => {
      const metaTagValues = [
        { label: "Title", value: "Just a title" },
        { label: "Author", value: "John Doe" },
      ];
      render(<MetaTagsGrid metaTagValues={metaTagValues} />);

      // Should have no external links for these values
      const links = screen.queryAllByRole("link");
      // Filter out any links that might be from external link icons
      const valueLinks = links.filter(
        (link) =>
          link.textContent?.includes("Just a title") ||
          link.textContent?.includes("John Doe"),
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
          { label: "Canonical", value: "https://example.com/page" },
        ],
        expectedTags: ["https://example.com/page"],
        expectedCount: 1,
      },
    ];

    for (const testCase of testCases) {
      it(`renders ${testCase.name}`, () => {
        render(<MetaTagsGrid metaTagValues={testCase.metaTagValues} />);

        // Verify count
        expect(
          screen.getByText(testCase.expectedCount.toString()),
        ).toBeInTheDocument();

        // Use getAllByText to handle elements that appear in multiple places
        for (const expectedTag of testCase.expectedTags) {
          const elements = screen.getAllByText(expectedTag);
          expect(elements.length).toBeGreaterThan(0);
        }
      });
    }
  });
});

/* @vitest-environment jsdom */
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { SeoSection } from "./seo-section";

vi.mock("@/components/domain/screenshot", () => ({
  Screenshot: ({ domain }: { domain: string }) => (
    <div data-slot="screenshot">{domain}</div>
  ),
}));

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

describe("SeoSection", () => {
  it("renders meta title and description", () => {
    const data = {
      meta: {
        openGraph: { title: "OG Title" },
        twitter: { card: "summary" },
        general: { robots: "index, follow" },
      },
      robots: null,
      preview: {
        title: "Page Title",
        description: "Page description",
        image: null,
        canonicalUrl: "https://example.com",
      },
      source: {
        statusCode: 200,
        finalUrl: "https://example.com",
        redirectChain: [],
      },
    } as unknown as import("@/lib/schemas").SeoResponse;
    render(<SeoSection domain="example.com" data={data} />);
    // Use getAllByText since title appears in multiple places (value + tooltip + preview)
    const titleElements = screen.getAllByText("Page Title");
    expect(titleElements.length).toBeGreaterThan(0);
  });

  it("shows empty state when no meta tags", () => {
    const data = {
      meta: {
        openGraph: {},
        twitter: {},
        general: {},
      },
      robots: null,
      preview: {
        title: null,
        description: null,
        image: null,
        canonicalUrl: null,
      },
      source: {
        statusCode: 200,
        finalUrl: "https://example.com",
        redirectChain: [],
      },
    } as unknown as import("@/lib/schemas").SeoResponse;
    render(<SeoSection domain="example.com" data={data} />);
    expect(screen.getByText(/No SEO meta detected/i)).toBeInTheDocument();
  });
});

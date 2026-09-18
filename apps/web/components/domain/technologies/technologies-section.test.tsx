import { describe, expect, it, vi } from "vitest";
import { page } from "vitest/browser";

import { render } from "@/mocks/react";

import { TechnologiesSection } from "./technologies-section";

vi.mock("@/components/icons/favicon", () => ({
  Favicon: ({ domain }: { domain: string | null | undefined }) => <div>favicon:{domain}</div>,
}));

import type { DetectedTechnology, TechnologiesResponse } from "@domainstack/types";

function tech(overrides: Partial<DetectedTechnology> = {}): DetectedTechnology {
  return {
    slug: "wordpress",
    name: "WordPress",
    categories: ["cms"],
    website: "https://wordpress.org",
    iconDomain: "wordpress.org",
    version: null,
    implied: false,
    detectedBy: ["html"],
    ...overrides,
  };
}

describe("TechnologiesSection", () => {
  it("groups technologies by category with a count pill", async () => {
    const data: TechnologiesResponse = {
      technologies: [
        tech({ slug: "shopify", name: "Shopify", categories: ["ecommerce"] }),
        tech({ slug: "php", name: "PHP", categories: ["programming-language"] }),
      ],
      source: { finalUrl: "https://example.com", status: 200 },
    };
    await render(<TechnologiesSection data={data} />);
    await expect.element(page.getByText("Ecommerce", { exact: true })).toBeInTheDocument();
    await expect.element(page.getByText("Programming Languages")).toBeInTheDocument();
    await expect.element(page.getByText("Shopify")).toBeInTheDocument();
    await expect.element(page.getByText("PHP")).toBeInTheDocument();
  });

  it("renders a version next to its technology", async () => {
    const data: TechnologiesResponse = {
      technologies: [tech({ version: "6.5" })],
      source: { finalUrl: null, status: null },
    };
    await render(<TechnologiesSection data={data} />);
    await expect.element(page.getByText("6.5")).toBeInTheDocument();
  });

  it("marks an implied technology without relying on color alone", async () => {
    const data: TechnologiesResponse = {
      technologies: [tech({ slug: "php", name: "PHP", implied: true, detectedBy: [] })],
      source: { finalUrl: null, status: null },
    };
    await render(<TechnologiesSection data={data} />);
    await expect.element(page.getByText("implied")).toBeInTheDocument();
  });

  it("renders without an icon or error when iconDomain is null", async () => {
    const data: TechnologiesResponse = {
      technologies: [tech({ iconDomain: null })],
      source: { finalUrl: null, status: null },
    };
    await render(<TechnologiesSection data={data} />);
    await expect.element(page.getByText("WordPress")).toBeInTheDocument();
  });

  it("shows the empty state when no technologies are detected", async () => {
    const data: TechnologiesResponse = {
      technologies: [],
      source: { finalUrl: null, status: null },
    };
    await render(<TechnologiesSection data={data} />);
    await expect.element(page.getByText(/No technologies detected/i)).toBeInTheDocument();
  });

  it("truncates a very long technology name", async () => {
    const longName = "A".repeat(120);
    const data: TechnologiesResponse = {
      technologies: [tech({ name: longName })],
      source: { finalUrl: null, status: null },
    };
    await render(<TechnologiesSection data={data} />);
    const nameElement = page.getByText(longName);
    await expect.element(nameElement).toBeInTheDocument();
    await expect.element(nameElement).toHaveClass(/truncate/);
  });
});

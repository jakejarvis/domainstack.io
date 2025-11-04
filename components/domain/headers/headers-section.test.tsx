/* @vitest-environment jsdom */
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { HeadersSection } from "./headers-section";

// Keep TooltipContent empty in unit tests to avoid text duplication issues.
vi.mock("@/components/ui/tooltip", () => ({
  Tooltip: ({ children }: { children: React.ReactNode }) => (
    <div data-slot="tooltip">{children}</div>
  ),
  TooltipTrigger: ({ children }: { children: React.ReactNode }) => (
    <button type="button" data-slot="tooltip-trigger">
      {children}
    </button>
  ),
  TooltipContent: (_: { children: React.ReactNode }) => null,
}));

describe("HeadersSection", () => {
  it("highlights important headers and renders values", () => {
    const data = [
      { name: "strict-transport-security", value: "max-age=63072000" },
      { name: "server", value: "vercel" },
      { name: "x-powered-by", value: "nextjs" },
    ];
    render(<HeadersSection data={data} />);
    expect(screen.getByText("strict-transport-security")).toBeInTheDocument();
    const values = screen.getAllByText("max-age=63072000");
    expect(values.some((n) => n.tagName.toLowerCase() === "span")).toBe(true);
  });

  it("shows empty state when no headers", () => {
    render(<HeadersSection data={null} />);
    expect(screen.getByText(/No HTTP headers detected/i)).toBeInTheDocument();
  });

  it("renders location header with link to destination domain", () => {
    const data = [{ name: "location", value: "https://www.example.com/path" }];
    render(<HeadersSection data={data} />);
    expect(screen.getByText("location")).toBeInTheDocument();
    expect(
      screen.getByText("https://www.example.com/path"),
    ).toBeInTheDocument();

    // Check that the link is rendered with correct href
    const link = screen.getByTitle("View report for example.com");
    expect(link).toHaveAttribute("href", "/example.com");
  });

  it("renders location header without link for relative URLs", () => {
    const data = [{ name: "location", value: "/relative/path" }];
    render(<HeadersSection data={data} />);
    expect(screen.getByText("location")).toBeInTheDocument();
    expect(screen.getByText("/relative/path")).toBeInTheDocument();

    // Should not have a link for relative URLs
    expect(screen.queryByTitle(/View report for/)).not.toBeInTheDocument();
  });
});

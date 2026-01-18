import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@/mocks/react";
import { HeadersSection } from "./headers-section";

// Keep TooltipContent empty in unit tests to avoid text duplication issues.
vi.mock("@/components/ui/tooltip", () => ({
  Tooltip: ({ children }: { children: React.ReactNode }) => (
    <div data-slot="tooltip">{children}</div>
  ),
  TooltipTrigger: ({
    children,
    render,
  }: {
    children?: React.ReactNode;
    render?: React.ReactNode;
  }) => (
    <button type="button" data-slot="tooltip-trigger">
      {render ?? children}
    </button>
  ),
  TooltipContent: (_: { children: React.ReactNode }) => null,
}));

describe("HeadersSection", () => {
  it("highlights important headers and renders values", () => {
    const data = {
      headers: [
        { name: "strict-transport-security", value: "max-age=63072000" },
        { name: "server", value: "vercel" },
        { name: "x-powered-by", value: "nextjs" },
      ],
      status: 200,
    };
    render(<HeadersSection data={data} />);
    expect(screen.getByText("strict-transport-security")).toBeInTheDocument();
    const values = screen.getAllByText("max-age=63072000");
    expect(values.some((n) => n.tagName.toLowerCase() === "span")).toBe(true);
  });

  it("sorts headers with important ones first, then alphabetically", () => {
    const data = {
      headers: [
        { name: "x-custom", value: "value1" },
        { name: "server", value: "nginx" }, // Important
        { name: "accept", value: "text/html" },
        { name: "content-security-policy", value: "default-src 'self'" }, // Important
        { name: "zebra", value: "last" },
      ],
      status: 200,
    };
    const { container } = render(<HeadersSection data={data} />);

    // Get all header label elements (they have uppercase styling via CSS)
    const allText = (container.textContent || "").toUpperCase();

    // Find positions of each header name in the rendered text
    const cspPos = allText.indexOf("CONTENT-SECURITY-POLICY");
    const serverPos = allText.indexOf("SERVER");
    const acceptPos = allText.indexOf("ACCEPT");
    const xCustomPos = allText.indexOf("X-CUSTOM");
    const zebraPos = allText.indexOf("ZEBRA");

    // All headers should be found
    expect(cspPos).toBeGreaterThan(-1);
    expect(serverPos).toBeGreaterThan(-1);
    expect(acceptPos).toBeGreaterThan(-1);
    expect(xCustomPos).toBeGreaterThan(-1);
    expect(zebraPos).toBeGreaterThan(-1);

    // Important headers (content-security-policy, server) should appear before non-important headers in the text
    expect(cspPos).toBeLessThan(acceptPos);
    expect(cspPos).toBeLessThan(xCustomPos);
    expect(serverPos).toBeLessThan(acceptPos);
    expect(serverPos).toBeLessThan(xCustomPos);

    // Non-important headers should be alphabetically sorted
    expect(acceptPos).toBeLessThan(xCustomPos);
    expect(xCustomPos).toBeLessThan(zebraPos);
  });

  it("shows empty state when no headers", () => {
    render(<HeadersSection data={null} />);
    expect(screen.getByText(/No HTTP headers detected/i)).toBeInTheDocument();
  });

  it("renders location header with link to destination domain", () => {
    const data = {
      headers: [{ name: "location", value: "https://www.test.invalid/path" }],
      status: 301,
    };
    render(<HeadersSection data={data} />);
    expect(screen.getByText("location")).toBeInTheDocument();
    expect(
      screen.getByText("https://www.test.invalid/path"),
    ).toBeInTheDocument();

    // Check that the link is rendered with correct href
    const link = screen.getByTitle("View report for test.invalid");
    expect(link).toHaveAttribute("href", "/test.invalid");
  });

  it("renders location header without link for relative URLs", () => {
    const data = {
      headers: [{ name: "location", value: "/relative/path" }],
      status: 302,
    };
    render(<HeadersSection data={data} />);
    expect(screen.getByText("location")).toBeInTheDocument();
    expect(screen.getByText("/relative/path")).toBeInTheDocument();

    // Should not have a link for relative URLs
    expect(screen.queryByTitle(/View report for/)).not.toBeInTheDocument();
  });

  it("shows alert for non-200 status codes", () => {
    const data = {
      headers: [{ name: "server", value: "nginx" }],
      status: 404,
      statusMessage: "Not Found",
    };
    render(<HeadersSection data={data} />);

    // Check that alert is displayed with link
    expect(screen.getByText(/Server returned/)).toBeInTheDocument();
    expect(screen.getByText(/404/)).toBeInTheDocument();
    expect(screen.getByText(/Not Found/)).toBeInTheDocument();
  });

  it("filters out headers with empty values", () => {
    const data = {
      headers: [
        { name: "server", value: "nginx" },
        { name: "empty-header", value: "" },
        { name: "whitespace-header", value: "   " },
        { name: "x-powered-by", value: "nextjs" },
      ],
      status: 200,
      statusMessage: "OK",
    };
    render(<HeadersSection data={data} />);

    // Check that only non-empty headers are rendered
    expect(screen.getByText("server")).toBeInTheDocument();
    expect(screen.getByText("nginx")).toBeInTheDocument();
    expect(screen.getByText("x-powered-by")).toBeInTheDocument();
    expect(screen.getByText("nextjs")).toBeInTheDocument();

    // Empty headers should not be rendered
    expect(screen.queryByText("empty-header")).not.toBeInTheDocument();
    expect(screen.queryByText("whitespace-header")).not.toBeInTheDocument();
  });

  it("does not show alert for 200 status code", () => {
    const data = {
      headers: [{ name: "server", value: "nginx" }],
      status: 200,
      statusMessage: "OK",
    };
    render(<HeadersSection data={data} />);

    // Check that alert is NOT displayed
    expect(screen.queryByText(/HTTP 200/)).not.toBeInTheDocument();
  });
});

import { describe, expect, it, vi } from "vitest";
import { page } from "vitest/browser";

import { render } from "@/mocks/react";

import { HeadersSection } from "./headers-section";

// Keep TooltipContent empty in unit tests to avoid text duplication issues.
vi.mock("@/components/ui/tooltip", () => ({
  Tooltip: ({ children }: { children: React.ReactNode }) => (
    <div data-slot="tooltip">{children}</div>
  ),
  TooltipTrigger: ({
    children,
    render: renderProp,
  }: {
    children?: React.ReactNode;
    render?: React.ReactNode;
  }) => (
    <button type="button" data-slot="tooltip-trigger">
      {renderProp ?? children}
    </button>
  ),
  TooltipContent: (_: { children: React.ReactNode }) => null,
}));

describe("HeadersSection", () => {
  it("highlights important headers and renders values", async () => {
    const data = {
      headers: [
        { name: "strict-transport-security", value: "max-age=63072000" },
        { name: "server", value: "vercel" },
        { name: "x-powered-by", value: "nextjs" },
      ],
      status: 200,
    };
    await render(<HeadersSection data={data} />);
    await expect
      .element(page.getByText("strict-transport-security", { exact: true }))
      .toBeInTheDocument();
    expect(
      page
        .getByText("max-age=63072000", { exact: true })
        .elements()
        .some((n) => n.tagName.toLowerCase() === "span"),
    ).toBe(true);
  });

  it("sorts headers with important ones first, then alphabetically", async () => {
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
    const { container } = await render(<HeadersSection data={data} />);

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

  it("shows empty state when no headers", async () => {
    await render(<HeadersSection data={null} />);
    await expect.element(page.getByText(/No HTTP headers detected/i)).toBeInTheDocument();
  });

  it("renders location header with link to destination domain", async () => {
    const data = {
      headers: [{ name: "location", value: "https://www.test.invalid/path" }],
      status: 301,
    };
    await render(<HeadersSection data={data} />);
    await expect.element(page.getByText("location", { exact: true })).toBeInTheDocument();
    await expect
      .element(page.getByText("https://www.test.invalid/path", { exact: true }))
      .toBeInTheDocument();

    // Check that the link is rendered with correct href
    await expect
      .element(page.getByTitle("View report for test.invalid"))
      .toHaveAttribute("href", "/test.invalid");
  });

  it("renders location header without link for relative URLs", async () => {
    const data = {
      headers: [{ name: "location", value: "/relative/path" }],
      status: 302,
    };
    await render(<HeadersSection data={data} />);
    await expect.element(page.getByText("location", { exact: true })).toBeInTheDocument();
    await expect.element(page.getByText("/relative/path", { exact: true })).toBeInTheDocument();

    // Should not have a link for relative URLs
    await expect.element(page.getByTitle(/View report for/)).not.toBeInTheDocument();
  });

  it("shows alert for non-200 status codes", async () => {
    const data = {
      headers: [{ name: "server", value: "nginx" }],
      status: 404,
      statusMessage: "Not Found",
    };
    await render(<HeadersSection data={data} />);

    // Check that alert is displayed with link
    await expect.element(page.getByText(/Server returned/)).toBeInTheDocument();
    await expect.element(page.getByText(/404/)).toBeInTheDocument();
    await expect.element(page.getByText(/Not Found/)).toBeInTheDocument();
  });

  it("filters out headers with empty values", async () => {
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
    await render(<HeadersSection data={data} />);

    // Check that only non-empty headers are rendered
    await expect.element(page.getByText("server", { exact: true })).toBeInTheDocument();
    await expect.element(page.getByText("nginx", { exact: true })).toBeInTheDocument();
    await expect.element(page.getByText("x-powered-by", { exact: true })).toBeInTheDocument();
    await expect.element(page.getByText("nextjs", { exact: true })).toBeInTheDocument();

    // Empty headers should not be rendered
    await expect.element(page.getByText("empty-header", { exact: true })).not.toBeInTheDocument();
    await expect
      .element(page.getByText("whitespace-header", { exact: true }))
      .not.toBeInTheDocument();
  });

  it("does not show alert for 200 status code", async () => {
    const data = {
      headers: [{ name: "server", value: "nginx" }],
      status: 200,
      statusMessage: "OK",
    };
    await render(<HeadersSection data={data} />);

    // Check that alert is NOT displayed
    await expect.element(page.getByText(/HTTP 200/)).not.toBeInTheDocument();
  });
});

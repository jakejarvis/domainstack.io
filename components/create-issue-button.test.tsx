/* @vitest-environment jsdom */
import { describe, expect, it } from "vitest";
import { CreateIssueButton } from "@/components/create-issue-button";
import { render, screen } from "@/lib/test-utils";

describe("CreateIssueButton", () => {
  it("renders with icon and label", () => {
    render(<CreateIssueButton />);
    // lucide icons render an svg with aria-hidden=true; presence of svg is enough
    expect(
      screen.getByRole("link", { name: /create github issue/i }),
    ).toBeInTheDocument();
    // The svg isn't directly role-accessible; check it exists under the link
    const linkEl = screen.getByRole("link", { name: /create github issue/i });
    expect(linkEl.querySelector("svg")).not.toBeNull();
  });

  it("prefills URL parameters", () => {
    const error = new Error("Something exploded");
    render(<CreateIssueButton error={error} />);
    const link = screen.getByRole("link", {
      name: /create github issue/i,
    }) as HTMLAnchorElement;
    const url = new URL(link.href);
    expect(url.hostname).toBe("github.com");
    expect(url.pathname).toMatch(/\/issues\/new$/);
    expect(url.searchParams.get("labels")).toBe("bug");
    expect(url.searchParams.get("title")).toMatch(/Something exploded/);
    const body = url.searchParams.get("body") ?? "";
    expect(body).toMatch(/### Description/);
    expect(body).toMatch(/### Error/);
    expect(body).toMatch(/Message: Something exploded/);
  });
});

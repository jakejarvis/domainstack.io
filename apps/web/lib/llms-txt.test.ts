/* @vitest-environment node */
import { describe, expect, it } from "vitest";

import { GET } from "@/app/llms.txt/route";
import { MCP_SECTION_TOOLS } from "@/lib/constants/mcp-tools";

import { buildLlmsTxt } from "./llms-txt";

describe("llms.txt", () => {
  const body = buildLlmsTxt("https://domainstack.io");
  const lines = body.split("\n");

  it("starts with an H1 followed by a blockquote summary", () => {
    expect(lines[0]).toBe("# Domainstack");
    expect(lines[1]).toBe("");
    expect(lines[2]).toMatch(/^> \S/);
  });

  it("uses no headings other than the H1 and H2 link sections", () => {
    const headings = lines.filter((line) => line.startsWith("#"));
    expect(headings.filter((line) => !line.startsWith("## ") && line !== "# Domainstack")).toEqual(
      [],
    );
  });

  it("lists every link as an absolute URL on the configured origin", () => {
    const urls = [...body.matchAll(/\]\((\S+?)\)/g)].map((match) => match[1]);
    expect(urls.length).toBeGreaterThan(0);
    for (const href of urls) {
      expect(href).toMatch(/^https:\/\/(domainstack\.io|github\.com)\//);
    }
    expect(urls).toContain("https://domainstack.io/api/transport/mcp");
    expect(urls).toContain("https://domainstack.io/.well-known/mcp/server-card.json");
  });

  it("mentions every MCP tool", () => {
    for (const tool of Object.values(MCP_SECTION_TOOLS)) {
      expect(body).toContain(tool.name);
    }
    expect(body).toContain("domain_report");
  });

  it("tells agents when to use each tool and how to call it", () => {
    expect(body).toContain("When to use Domainstack");
    expect(body).toContain("How to call it");
    for (const tool of Object.values(MCP_SECTION_TOOLS)) {
      expect(body).toMatch(new RegExp(`- \`${tool.name}\`: \\S`));
    }
  });

  it("serves plain text", async () => {
    const response = GET();
    expect(response.headers.get("content-type")).toBe("text/plain; charset=utf-8");
    expect(await response.text()).toContain("# Domainstack");
  });
});

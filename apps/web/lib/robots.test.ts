import { describe, expect, it } from "vitest";

import type { RobotsTxt } from "@domainstack/types";

import { filterRobotsGroups, summarizeRobots } from "./robots";

function robots(groups: RobotsTxt["groups"]): RobotsTxt {
  return { fetched: true, groups, sitemaps: [] };
}

describe("summarizeRobots", () => {
  it("sorts `*` groups first, then Googlebot, then others", () => {
    const { groups } = summarizeRobots(
      robots([
        { userAgents: ["Bingbot"], rules: [{ type: "disallow", value: "/a" }] },
        { userAgents: ["Googlebot-Image"], rules: [{ type: "disallow", value: "/b" }] },
        { userAgents: ["GPTBot", "*"], rules: [{ type: "disallow", value: "/c" }] },
      ]),
    );

    expect(groups.map((g) => g.key)).toEqual(["GPTBot,*", "Googlebot-Image", "Bingbot"]);
    expect(groups[0]?.userAgents).toEqual(["*", "GPTBot"]);
  });

  it("counts only non-empty allow and disallow rules", () => {
    const { counts } = summarizeRobots(
      robots([
        {
          userAgents: ["*"],
          rules: [
            { type: "allow", value: "/public" },
            { type: "disallow", value: "/admin" },
            { type: "disallow", value: "/tmp" },
            { type: "disallow", value: "  " },
            { type: "crawlDelay", value: "10" },
          ],
        },
      ]),
    );

    expect(counts).toEqual({ allow: 1, disallow: 2 });
  });

  it("folds bare Allow/Disallow lines into flags", () => {
    const { groups } = summarizeRobots(
      robots([{ userAgents: ["*"], rules: [{ type: "disallow", value: "" }] }]),
    );

    expect(groups).toEqual([
      { key: "*", userAgents: ["*"], rules: [], hasEmptyAllow: false, hasEmptyDisallow: true },
    ]);
  });

  it("keeps groups that only have crawl-delay or content-signal rules", () => {
    const { groups, counts } = summarizeRobots(
      robots([{ userAgents: ["*"], rules: [{ type: "crawlDelay", value: "5" }] }]),
    );

    expect(groups).toHaveLength(1);
    expect(counts).toEqual({ allow: 0, disallow: 0 });
  });

  it("drops groups with no directives", () => {
    const { groups } = summarizeRobots(robots([{ userAgents: ["Bingbot"], rules: [] }]));

    expect(groups).toEqual([]);
  });
});

describe("filterRobotsGroups", () => {
  const { groups } = summarizeRobots(
    robots([
      {
        userAgents: ["*"],
        rules: [
          { type: "allow", value: "/Public" },
          { type: "disallow", value: "/admin" },
        ],
      },
      { userAgents: ["Googlebot"], rules: [{ type: "disallow", value: "/private" }] },
      { userAgents: ["Bingbot"], rules: [{ type: "disallow", value: "" }] },
    ]),
  );

  it("returns groups unchanged when no filter is active", () => {
    expect(filterRobotsGroups(groups, { query: " ", only: "all" })).toBe(groups);
  });

  it("filters by rule type and drops groups left empty", () => {
    const result = filterRobotsGroups(groups, { query: "", only: "allow" });

    expect(result.map((g) => g.key)).toEqual(["*"]);
    expect(result[0]?.rules).toEqual([{ type: "allow", value: "/Public" }]);
  });

  it("matches the query case-insensitively after trimming", () => {
    const result = filterRobotsGroups(groups, { query: " PUB ", only: "all" });

    expect(result.map((g) => g.key)).toEqual(["*"]);
    expect(result[0]?.rules).toEqual([{ type: "allow", value: "/Public" }]);
  });

  it("combines the query with the rule type", () => {
    expect(filterRobotsGroups(groups, { query: "pub", only: "disallow" })).toEqual([]);
  });
});

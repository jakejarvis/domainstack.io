import type { RobotsRule, RobotsTxt } from "@domainstack/types";

export type RobotsRuleFilter = "all" | "allow" | "disallow";

export type RobotsGroupSummary = {
  /** Stable identity for React keys and accordion values. */
  key: string;
  /** User agents in display order, with `*` first. */
  userAgents: string[];
  /** Rules with a value; bare `Allow:`/`Disallow:` lines are folded into the flags below. */
  rules: RobotsRule[];
  hasEmptyAllow: boolean;
  hasEmptyDisallow: boolean;
};

export type RobotsSummaryData = {
  groups: RobotsGroupSummary[];
  counts: { allow: number; disallow: number };
};

function agentRank(agents: string[]): number {
  if (agents.includes("*")) return 0;
  if (agents.some((ua) => ua.toLowerCase().includes("googlebot"))) return 1;
  return 2;
}

/**
 * Normalizes parsed robots.txt groups for display: `*` groups first, then Googlebot,
 * then everyone else. Groups with no directives at all are dropped.
 */
export function summarizeRobots(robots: RobotsTxt): RobotsSummaryData {
  const counts = { allow: 0, disallow: 0 };

  const groups = robots.groups
    .toSorted((a, b) => agentRank(a.userAgents) - agentRank(b.userAgents))
    .map((g): RobotsGroupSummary => {
      const rules: RobotsRule[] = [];
      let hasEmptyAllow = false;
      let hasEmptyDisallow = false;

      for (const rule of g.rules) {
        if (rule.value.trim() !== "") {
          rules.push(rule);
          if (rule.type === "allow" || rule.type === "disallow") counts[rule.type]++;
        } else if (rule.type === "allow") {
          hasEmptyAllow = true;
        } else if (rule.type === "disallow") {
          hasEmptyDisallow = true;
        }
      }

      return {
        key: g.userAgents.join(","),
        userAgents: g.userAgents.includes("*")
          ? ["*", ...g.userAgents.filter((ua) => ua !== "*")]
          : g.userAgents,
        rules,
        hasEmptyAllow,
        hasEmptyDisallow,
      };
    })
    .filter((g) => g.rules.length > 0 || g.hasEmptyAllow || g.hasEmptyDisallow);

  return { groups, counts };
}

/**
 * Narrows each group's rules by type and a case-insensitive substring. With either
 * filter active, groups left without matching rules are dropped.
 */
export function filterRobotsGroups(
  groups: RobotsGroupSummary[],
  { query, only }: { query: string; only: RobotsRuleFilter },
): RobotsGroupSummary[] {
  const q = query.trim().toLowerCase();
  if (!q && only === "all") return groups;

  return groups
    .map((g) => ({
      ...g,
      rules: g.rules.filter(
        (r) => (only === "all" || r.type === only) && (!q || r.value.toLowerCase().includes(q)),
      ),
    }))
    .filter((g) => g.rules.length > 0);
}

import {
  IconAsterisk,
  IconBan,
  IconChevronRight,
  IconCircleCheck,
  IconCircleHalf2,
  IconClockPause,
  IconDotsVertical,
  IconExternalLink,
  IconFilter,
  IconHelp,
  IconWaveSquare,
  IconX,
} from "@tabler/icons-react";
import { useDeferredValue, useMemo, useState } from "react";

import { PillCount } from "@/components/domain/pill-count";
import {
  filterRobotsGroups,
  type RobotsGroupSummary,
  type RobotsRuleFilter,
  type RobotsSummaryData,
  summarizeRobots,
} from "@/lib/robots";
import type { RobotsRule, SeoResponse } from "@domainstack/types";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@domainstack/ui/accordion";
import { Button } from "@domainstack/ui/button";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@domainstack/ui/empty";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
} from "@domainstack/ui/input-group";
import { ToggleGroup, ToggleGroupItem } from "@domainstack/ui/toggle-group";
import { Tooltip, TooltipContent, TooltipTrigger } from "@domainstack/ui/tooltip";
import { cn } from "@domainstack/ui/utils";

const RULES_PREVIEW = 6;
const SITEMAPS_PREVIEW = 2;
const REVEAL_CLASS = "animate-in duration-200 ease-out fade-in-0 motion-reduce:animate-none";
const EMPTY_SUMMARY: RobotsSummaryData = { groups: [], counts: { allow: 0, disallow: 0 } };

function getRuleItems(rules: RobotsRule[]) {
  const seen = new Map<string, number>();

  return rules.map((rule) => {
    const baseKey = `${rule.type}-${rule.value}`;
    const duplicateCount = seen.get(baseKey) ?? 0;
    seen.set(baseKey, duplicateCount + 1);

    return { key: `${baseKey}-${duplicateCount}`, rule };
  });
}

function highlight(text: string, q: string) {
  if (!q) return text;
  const idx = text.toLowerCase().indexOf(q.toLowerCase());
  if (idx === -1) return text;
  const before = text.slice(0, idx);
  const match = text.slice(idx, idx + q.length);
  const after = text.slice(idx + q.length);
  return (
    <>
      {before}
      <span className="bg-yellow-500/30 dark:bg-yellow-400/30">{match}</span>
      {after}
    </>
  );
}

export function RobotsSummary({
  domain,
  robots,
}: {
  domain: string;
  robots: SeoResponse["robots"];
}) {
  const summary = useMemo(() => (robots ? summarizeRobots(robots) : EMPTY_SUMMARY), [robots]);
  const { counts } = summary;
  const listedCount = counts.allow + counts.disallow;
  const sitemaps = robots?.sitemaps ?? [];

  const [query, setQuery] = useState("");
  const [only, setOnly] = useState<RobotsRuleFilter>("all");
  const q = useDeferredValue(query).trim();
  const isSearching = q !== "";
  const groups = useMemo(
    () => filterRobotsGroups(summary.groups, { query: q, only }),
    [summary, q, only],
  );

  // Open the `*` group by default; summarizeRobots sorts it first.
  const [openGroups, setOpenGroups] = useState<string[]>(() => {
    const first = summary.groups[0];
    return first?.userAgents[0] === "*" ? [first.key] : [];
  });

  const resetFilters = () => {
    setQuery("");
    setOnly("all");
  };

  return (
    <div className="space-y-4">
      <div className="mt-5 flex items-center gap-2 text-[11px] leading-none tracking-[0.08em] text-foreground/70 uppercase dark:text-foreground/80">
        <a
          href={`https://${domain}/robots.txt`}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 hover:underline hover:underline-offset-3"
        >
          <span>robots.txt</span>
          <IconExternalLink className="relative bottom-px inline-flex size-3" aria-hidden />
        </a>
        <PillCount count={listedCount} color="blue" />
      </div>

      <div className="space-y-4">
        {listedCount > 0 ? (
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <InputGroup className="sm:flex-1">
              <InputGroupInput
                name="robots-filter"
                placeholder="Filter rules…"
                value={query}
                onChange={(e) => setQuery(e.currentTarget.value)}
                aria-label="Filter robots rules"
                autoComplete="off"
                autoCorrect="off"
                autoCapitalize="none"
                spellCheck={false}
              />
              <InputGroupAddon>
                <IconFilter aria-hidden />
              </InputGroupAddon>
              {query ? (
                <InputGroupAddon align="inline-end">
                  <InputGroupButton
                    size="sm"
                    variant="ghost"
                    onClick={() => setQuery("")}
                    aria-label="Clear filter"
                  >
                    <IconX aria-hidden />
                  </InputGroupButton>
                </InputGroupAddon>
              ) : null}
            </InputGroup>

            <ToggleGroup
              multiple={false}
              value={[only]}
              onValueChange={(groupValue) => {
                const next = groupValue[0] as RobotsRuleFilter | undefined;
                setOnly(next ?? "all");
              }}
              spacing={1}
              className="relative h-9 w-full items-stretch overflow-hidden rounded-lg border bg-muted/40 p-1 text-muted-foreground sm:w-auto [&>*]:flex-1 sm:[&>*]:flex-none"
            >
              <ToggleGroupItem value="all" className="h-full">
                <IconCircleHalf2 className="size-3.5 text-accent-blue" aria-hidden />
                <span className="text-[13px]">All</span>
                <PillCount count={listedCount} color="slate" />
              </ToggleGroupItem>
              <ToggleGroupItem value="allow" className="h-full">
                <IconCircleCheck className="size-3.5 text-accent-green" aria-hidden />
                <span className="text-[13px]">Allow</span>
                <PillCount count={counts.allow} color="slate" />
              </ToggleGroupItem>
              <ToggleGroupItem value="disallow" className="h-full">
                <IconBan className="size-3.5 text-destructive" aria-hidden />
                <span className="text-[13px]">Disallow</span>
                <PillCount count={counts.disallow} color="slate" />
              </ToggleGroupItem>
            </ToggleGroup>
          </div>
        ) : null}

        {groups.length > 0 ? (
          // While searching, every matching group is forced open; otherwise the user's
          // choice is kept, keyed by user-agent so it survives filtering.
          <Accordion
            hiddenUntilFound
            multiple={isSearching}
            value={isSearching ? groups.map((g) => g.key) : openGroups}
            onValueChange={(value) => {
              if (!isSearching) setOpenGroups(value);
            }}
          >
            {groups.map((group) => (
              <RobotsGroupItem key={group.key} group={group} query={q} only={only} />
            ))}
          </Accordion>
        ) : summary.groups.length > 0 ? (
          <div className="text-sm text-muted-foreground">
            No matching rules.
            <Button variant="link" className="px-1" onClick={resetFilters}>
              Reset filters
            </Button>
          </div>
        ) : sitemaps.length > 0 ? (
          <Empty className="border border-solid bg-background/60">
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <IconHelp aria-hidden />
              </EmptyMedia>
              <EmptyTitle>No Crawl Rules Detected</EmptyTitle>
              <EmptyDescription>
                This website&rsquo;s robots.txt only declares sitemaps; no crawl rules are
                specified.
              </EmptyDescription>
            </EmptyHeader>
          </Empty>
        ) : null}

        {sitemaps.length > 0 ? <SitemapsList items={sitemaps} /> : null}
      </div>
    </div>
  );
}

function RobotsGroupItem({
  group,
  query,
  only,
}: {
  group: RobotsGroupSummary;
  query: string;
  only: RobotsRuleFilter;
}) {
  const allowN = group.rules.filter((r) => r.type === "allow").length;
  const disallowN = group.rules.filter((r) => r.type === "disallow").length;

  return (
    <AccordionItem value={group.key} className={cn("border-b-0", REVEAL_CLASS)}>
      <AccordionTrigger className="group/accordion items-start px-2 py-2 hover:bg-accent/35 hover:no-underline data-[panel-open]:pr-2 [&>svg]:hidden">
        <div className="flex w-full items-start justify-between gap-3">
          <div className="flex min-w-0 flex-wrap items-center gap-1.5">
            <IconChevronRight
              className="size-3 text-muted-foreground transition-transform group-data-[panel-open]/accordion:rotate-90 motion-reduce:transition-none"
              aria-hidden
            />
            {group.userAgents.map((ua) => (
              <span
                key={ua}
                className={cn(
                  "flex items-center gap-1 rounded px-1.5 py-1 text-xs leading-none whitespace-nowrap",
                  ua === "*" ? "bg-accent-purple/18 text-accent-purple" : "bg-muted",
                )}
              >
                {ua === "*" ? (
                  <>
                    <IconAsterisk className="size-3" aria-hidden />
                    All bots
                  </>
                ) : (
                  ua
                )}
              </span>
            ))}
          </div>
          <div className="shrink-0 pt-1 text-xs leading-none whitespace-nowrap text-muted-foreground">
            {[only !== "disallow" && `${allowN} allow`, only !== "allow" && `${disallowN} disallow`]
              .filter(Boolean)
              .join(" · ")}
          </div>
        </div>
      </AccordionTrigger>
      <AccordionContent className="pb-2">
        <GroupRules group={group} query={query} />
      </AccordionContent>
    </AccordionItem>
  );
}

function GroupRules({ group, query }: { group: RobotsGroupSummary; query: string }) {
  const [expanded, setExpanded] = useState(false);
  const ruleItems = getRuleItems(group.rules);
  const shown = query || expanded ? ruleItems : ruleItems.slice(0, RULES_PREVIEW);
  const more = ruleItems.length - shown.length;

  return (
    <div className="flex flex-col py-2">
      {group.rules.length === 0 && group.hasEmptyDisallow ? (
        <div className="rounded-md bg-muted/30 px-2 py-1 text-[13px] text-muted-foreground/90">
          No disallow restrictions (allow all)
        </div>
      ) : null}
      {group.rules.length === 0 && group.hasEmptyAllow ? (
        <div className="rounded-md bg-muted/30 px-2 py-1 text-[13px] text-muted-foreground/90">
          No explicit allow paths
        </div>
      ) : null}
      {/* CSS animations only run on mount, so only newly revealed rows fade in */}
      {shown.map(({ key, rule }, i) => (
        <div
          key={key}
          className={cn(
            "flex items-center gap-2 border-t border-muted px-2 py-2.5 font-mono text-xs first:border-t-0",
            i >= RULES_PREVIEW && REVEAL_CLASS,
          )}
        >
          <RuleTypeDot type={rule.type} />
          <span className="truncate">{highlight(rule.value, query)}</span>
        </div>
      ))}
      {more > 0 ? (
        <div className="mt-1 flex justify-start">
          <Button
            size="sm"
            variant="outline"
            className="text-[12px]"
            onClick={() => setExpanded(true)}
          >
            <IconDotsVertical className="!size-3.5" aria-hidden />
            <span>Show {more} more</span>
          </Button>
        </div>
      ) : null}
    </div>
  );
}

const ruleTypeConfig = {
  allow: {
    Icon: IconCircleCheck,
    label: "Allow",
    colorClass: "text-accent-green",
  },
  disallow: {
    Icon: IconBan,
    label: "Disallow",
    colorClass: "text-destructive",
  },
  crawlDelay: {
    Icon: IconClockPause,
    label: "Crawl delay",
    colorClass: "text-accent-orange",
  },
  contentSignal: {
    Icon: IconWaveSquare,
    label: "Content signal",
    colorClass: "text-accent-purple",
  },
} as const;

function RuleTypeDot({ type }: { type: RobotsRule["type"] }) {
  const { Icon, label, colorClass } = ruleTypeConfig[type];

  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <button
            type="button"
            className="flex size-4 items-center justify-center"
            aria-label={label}
          >
            <Icon className={cn("size-3.5", colorClass)} aria-hidden />
          </button>
        }
      />
      <TooltipContent side="left" sideOffset={8}>
        {label}
      </TooltipContent>
    </Tooltip>
  );
}

function SitemapsList({ items }: { items: string[] }) {
  const [expanded, setExpanded] = useState(false);
  const shown = expanded ? items : items.slice(0, SITEMAPS_PREVIEW);
  const more = items.length - shown.length;

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 text-[11px] leading-none tracking-[0.08em] text-foreground/70 uppercase dark:text-foreground/80">
        <span>Sitemaps</span>
        <PillCount count={items.length} color="green" />
      </div>
      <div className="flex flex-col gap-2.5">
        {shown.map((url, i) => (
          <div key={url} className={cn("flex items-center", i >= SITEMAPS_PREVIEW && REVEAL_CLASS)}>
            <a
              className="flex items-center gap-1.5 truncate text-[13px] font-medium text-foreground/85 hover:text-foreground/60 hover:no-underline"
              href={url}
              target="_blank"
              rel="noopener"
            >
              {url}
              <IconExternalLink className="size-3" aria-hidden />
            </a>
          </div>
        ))}
        {more > 0 ? (
          <div className="mt-1 flex justify-start">
            <Button
              size="sm"
              variant="outline"
              className="text-[12px]"
              onClick={() => setExpanded(true)}
            >
              <IconDotsVertical className="!size-3.5" aria-hidden />
              <span>Show {more} more</span>
            </Button>
          </div>
        ) : null}
      </div>
    </div>
  );
}

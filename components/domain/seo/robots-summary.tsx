import {
  Asterisk,
  Ban,
  ChevronRight,
  CircleCheck,
  CircleDot,
  ClockFading,
  EllipsisVertical,
  ExternalLink,
  FileQuestionMark,
  Filter,
  Signal,
  XIcon,
} from "lucide-react";
import * as motion from "motion/react-client";
import { useCallback, useMemo, useState } from "react";
import { PillCount } from "@/components/domain/pill-count";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Button } from "@/components/ui/button";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
} from "@/components/ui/input-group";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useProgressiveReveal } from "@/hooks/use-progressive-reveal";
import type { SeoResponse } from "@/lib/schemas";
import { cn } from "@/lib/utils";

export function RobotsSummary({
  domain,
  robots,
}: {
  domain: string;
  robots: SeoResponse["robots"];
}) {
  const has =
    !!robots &&
    robots.fetched &&
    ((robots.groups?.length ?? 0) > 0 || (robots.sitemaps?.length ?? 0) > 0);

  const counts = useMemo(() => {
    const isNonEmpty = (r: { value: string }) => r.value.trim() !== "";
    const disallows =
      robots?.groups.reduce(
        (acc, g) =>
          acc +
          g.rules.filter((r) => r.type === "disallow" && isNonEmpty(r)).length,
        0,
      ) ?? 0;
    const allows =
      robots?.groups.reduce(
        (acc, g) =>
          acc +
          g.rules.filter((r) => r.type === "allow" && isNonEmpty(r)).length,
        0,
      ) ?? 0;
    return { allows, disallows };
  }, [robots]);

  const hasAnyListedRules = useMemo(() => {
    const groups = robots?.groups ?? [];
    for (const g of groups) {
      for (const r of g.rules) {
        if (
          (r.type === "allow" || r.type === "disallow") &&
          r.value.trim() !== ""
        ) {
          return true;
        }
      }
    }
    return false;
  }, [robots]);

  const [query, setQuery] = useState("");
  const [only, setOnly] = useState<"all" | "allow" | "disallow">("all");

  const rankAgents = useCallback((agents: string[]): number => {
    const joined = agents.join(",").toLowerCase();
    if (agents.includes("*")) return 0;
    if (/googlebot/.test(joined)) return 1;
    return 2;
  }, []);

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

  const filteredGroups = useMemo(() => {
    const base = robots?.groups?.slice() ?? [];
    const sorted = base.sort(
      (a, b) => rankAgents(a.userAgents) - rankAgents(b.userAgents),
    );
    const isNonEmpty = (r: { value: string }) => r.value.trim() !== "";
    return sorted.map((g) => {
      const hasEmptyAllow = g.rules.some(
        (r) => r.type === "allow" && !isNonEmpty(r),
      );
      const hasEmptyDisallow = g.rules.some(
        (r) => r.type === "disallow" && !isNonEmpty(r),
      );
      const visible = g.rules
        .filter(isNonEmpty)
        .filter((r) => (only === "all" ? true : r.type === only))
        .filter((r) =>
          query ? r.value.toLowerCase().includes(query.toLowerCase()) : true,
        );
      return { ...g, rules: visible, hasEmptyAllow, hasEmptyDisallow } as {
        userAgents: string[];
        rules: {
          type: "allow" | "disallow" | "crawlDelay" | "contentSignal";
          value: string;
        }[];
        hasEmptyAllow: boolean;
        hasEmptyDisallow: boolean;
      };
    });
  }, [robots, only, query, rankAgents]);

  const hasFilteredRules = filteredGroups.some((g) => g.rules.length > 0);
  const filtersActive = query.trim().length > 0 || only !== "all";
  const displayGroups = useMemo(
    () =>
      filtersActive
        ? filteredGroups.filter((g) => g.rules.length > 0)
        : filteredGroups,
    [filteredGroups, filtersActive],
  );

  return (
    <div className="space-y-4 rounded-xl">
      <div className="mt-5 flex items-center gap-2 text-[11px] text-foreground/70 uppercase leading-none tracking-[0.08em] dark:text-foreground/80">
        <a
          href={`https://${domain}/robots.txt`}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 hover:underline hover:underline-offset-3"
        >
          <span>robots.txt</span>
          <ExternalLink
            className="relative bottom-px inline-flex size-3"
            aria-hidden="true"
          />
        </a>
        <PillCount
          count={(counts.allows + counts.disallows) as number}
          color="blue"
        />
      </div>

      {has ? (
        <div className="space-y-4">
          {hasAnyListedRules ? (
            <>
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
                    <Filter />
                  </InputGroupAddon>
                  {query ? (
                    <InputGroupAddon align="inline-end">
                      <InputGroupButton
                        type="button"
                        size="sm"
                        variant="ghost"
                        onClick={() => setQuery("")}
                      >
                        <XIcon />
                      </InputGroupButton>
                    </InputGroupAddon>
                  ) : null}
                </InputGroup>

                <ToggleGroup
                  multiple={false}
                  value={[only]}
                  onValueChange={(groupValue) => {
                    const next = groupValue[0] as typeof only | undefined;
                    setOnly(next ?? "all");
                  }}
                  withActiveIndicator
                  className="h-9 w-full items-stretch sm:w-auto [&>*]:flex-1 sm:[&>*]:flex-none"
                >
                  <ToggleGroupItem
                    value="all"
                    variant="ghost"
                    className="h-[calc(100%-1px)] cursor-pointer"
                  >
                    <CircleDot
                      className="size-3.5 text-accent-blue"
                      aria-hidden="true"
                    />
                    All
                    <PillCount
                      count={(counts.allows + counts.disallows) as number}
                      color="slate"
                    />
                  </ToggleGroupItem>
                  <ToggleGroupItem
                    value="allow"
                    variant="ghost"
                    className="h-[calc(100%-1px)] cursor-pointer"
                  >
                    <CircleCheck
                      className="size-3.5 text-accent-green"
                      aria-hidden="true"
                    />
                    <span>Allow</span>
                    <PillCount count={counts.allows} color="slate" />
                  </ToggleGroupItem>
                  <ToggleGroupItem
                    value="disallow"
                    variant="ghost"
                    className="h-[calc(100%-1px)] cursor-pointer"
                  >
                    <Ban
                      className="size-3.5 text-destructive"
                      aria-hidden="true"
                    />
                    <span>Disallow</span>
                    <PillCount count={counts.disallows} color="slate" />
                  </ToggleGroupItem>
                </ToggleGroup>
              </div>

              {filtersActive && !hasFilteredRules ? (
                <div className="text-muted-foreground text-sm">
                  No matching rules.
                  <Button
                    type="button"
                    variant="link"
                    className="px-1"
                    onClick={() => {
                      setQuery("");
                      setOnly("all");
                    }}
                  >
                    Reset filters
                  </Button>
                </div>
              ) : null}

              <GroupsAccordion
                groups={displayGroups}
                query={query}
                highlight={highlight}
                only={only}
              />
            </>
          ) : robots?.sitemaps?.length ? (
            <Empty className="border border-dashed">
              <EmptyHeader>
                <EmptyMedia variant="icon">
                  <FileQuestionMark />
                </EmptyMedia>
                <EmptyTitle>No crawl rules detected</EmptyTitle>
                <EmptyDescription>
                  This website&apos;s robots.txt only declares sitemaps; no
                  crawl rules are specified.
                </EmptyDescription>
              </EmptyHeader>
            </Empty>
          ) : null}

          {robots?.sitemaps?.length ? (
            <SitemapsList items={robots.sitemaps} />
          ) : null}
        </div>
      ) : (
        <Empty className="border border-dashed">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <FileQuestionMark />
            </EmptyMedia>
            <EmptyTitle>No robots.txt found</EmptyTitle>
            <EmptyDescription>
              We didn&apos;t find a robots.txt for this site. Crawlers will use
              default behavior until one is added.
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      )}
    </div>
  );
}

function RobotsGroupHeader({
  userAgents,
  allowN,
  disallowN,
  showAllow = true,
  showDisallow = true,
}: {
  userAgents: string[];
  allowN: number;
  disallowN: number;
  showAllow?: boolean;
  showDisallow?: boolean;
}) {
  return (
    <div className="flex w-full items-center justify-between">
      <div className="flex flex-wrap items-center gap-1.5">
        <ChevronRight className="size-3 text-muted-foreground transition-transform group-data-[panel-open]/accordion:rotate-90" />
        {userAgents.map((ua) => (
          <span
            key={ua}
            className={cn(
              "flex items-center gap-1 whitespace-nowrap rounded px-1.5 py-1 text-xs leading-none",
              ua === "*"
                ? "bg-accent-purple/18 text-accent-purple"
                : "bg-muted",
            )}
          >
            {ua === "*" ? (
              <>
                <Asterisk className="size-3" />
                All bots
              </>
            ) : (
              ua
            )}
          </span>
        ))}
      </div>
      <div className="shrink-0 text-muted-foreground text-xs">
        {showAllow ? `${allowN} allow` : null}
        {showAllow && showDisallow ? " · " : null}
        {showDisallow ? `${disallowN} disallow` : null}
      </div>
    </div>
  );
}

function GroupsAccordion({
  groups,
  query,
  highlight,
  only,
}: {
  groups: {
    userAgents: string[];
    rules: {
      type: "allow" | "disallow" | "crawlDelay" | "contentSignal";
      value: string;
    }[];
    hasEmptyAllow: boolean;
    hasEmptyDisallow: boolean;
  }[];
  query: string;
  highlight: (text: string, q: string) => React.ReactNode;
  only?: "all" | "allow" | "disallow";
}) {
  const defaultIdx = useMemo(
    () => groups.findIndex((g) => g.userAgents.includes("*")),
    [groups],
  );
  const defaultValue = defaultIdx >= 0 ? `g-${defaultIdx}` : undefined;
  const isSearching = Boolean(query);
  const openValues = useMemo(
    () => (isSearching ? groups.map((_, idx) => `g-${idx}`) : undefined),
    [groups, isSearching],
  );

  const content = groups.map((g, idx) => {
    const allowN = g.rules.filter((r) => r.type === "allow").length;
    const disallowN = g.rules.filter((r) => r.type === "disallow").length;
    const showAllow = isSearching ? true : only !== "disallow";
    const showDisallow = isSearching ? true : only !== "allow";
    return (
      <AccordionItem
        key={`g-${g.userAgents.join(",")}-${allowN}-${disallowN}`}
        value={`g-${idx}`}
        className="border-border/65"
      >
        <AccordionTrigger className="group/accordion cursor-pointer px-2 py-2 hover:bg-accent/35 hover:no-underline data-[panel-open]:pr-2 [&>svg]:hidden">
          <RobotsGroupHeader
            userAgents={g.userAgents}
            allowN={allowN}
            disallowN={disallowN}
            showAllow={showAllow}
            showDisallow={showDisallow}
          />
        </AccordionTrigger>
        <AccordionContent className="pb-2">
          <GroupContent
            rules={g.rules}
            query={query}
            highlight={highlight}
            only={only}
            hasEmptyAllow={g.hasEmptyAllow}
            hasEmptyDisallow={g.hasEmptyDisallow}
          />
        </AccordionContent>
      </AccordionItem>
    );
  });

  return isSearching ? (
    <Accordion key="accordion-search" multiple value={openValues}>
      {content}
    </Accordion>
  ) : (
    <Accordion
      key={`accordion-default-${defaultValue}`}
      defaultValue={defaultValue ? [defaultValue] : []}
    >
      {content}
    </Accordion>
  );
}

function GroupContent({
  rules,
  query,
  highlight,
  only,
  hasEmptyAllow,
  hasEmptyDisallow,
}: {
  rules: {
    type: "allow" | "disallow" | "crawlDelay" | "contentSignal";
    value: string;
  }[];
  query: string;
  highlight: (text: string, q: string) => React.ReactNode;
  only?: "all" | "allow" | "disallow";
  hasEmptyAllow: boolean;
  hasEmptyDisallow: boolean;
}) {
  const isSearching = query.trim().length > 0;
  const { existing, added, more, total, visible, setVisible } =
    useProgressiveReveal(rules, 6);
  if (isSearching) {
    return (
      <div className="flex flex-col">
        {rules.map((r, i) => (
          <RuleRow
            key={`r-${r.type}-${r.value}-all-${i}`}
            rule={r}
            query={query}
            highlight={highlight}
            isFirst={i === 0}
          />
        ))}
      </div>
    );
  }
  return (
    <div className="flex flex-col py-2">
      {rules.length === 0 && hasEmptyDisallow && only !== "allow" ? (
        <div className="rounded-md bg-muted/30 px-2 py-1 text-[13px] text-muted-foreground/90">
          No disallow restrictions (allow all)
        </div>
      ) : null}
      {rules.length === 0 && hasEmptyAllow && only !== "disallow" ? (
        <div className="rounded-md bg-muted/30 px-2 py-1 text-[13px] text-muted-foreground/90">
          No explicit allow paths
        </div>
      ) : null}
      {existing.map((r, i) => (
        <RuleRow
          key={`r-${r.type}-${r.value}-existing-${i}`}
          rule={r}
          query={query}
          highlight={highlight}
          isFirst={i === 0}
        />
      ))}
      {added.length > 0 ? (
        <motion.div
          key={`added-${visible}`}
          initial={{ height: 0, opacity: 0 }}
          animate={{ height: "auto", opacity: 1 }}
          transition={{ duration: 0.25, ease: "easeOut" }}
          style={{ overflow: "hidden" }}
          className="flex flex-col"
        >
          {added.map((r, i) => (
            <RuleRow
              key={`r-${r.type}-${r.value}-added-${i}`}
              rule={r}
              query={query}
              highlight={highlight}
            />
          ))}
        </motion.div>
      ) : null}
      {more > 0 ? (
        <div className="mt-1 flex justify-start">
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="text-[12px]"
            onClick={() => setVisible(total)}
          >
            <EllipsisVertical className="!h-3.5 !w-3.5" aria-hidden />
            <span>Show {more} more</span>
          </Button>
        </div>
      ) : null}
    </div>
  );
}

function RuleRow({
  rule,
  query,
  highlight,
  isFirst = false,
}: {
  rule: {
    type: "allow" | "disallow" | "crawlDelay" | "contentSignal";
    value: string;
  };
  query: string;
  highlight: (text: string, q: string) => React.ReactNode;
  isFirst?: boolean;
}) {
  return (
    <div
      className={cn(
        "group flex items-center gap-2 border-input border-t px-2 py-2.5 font-mono text-xs",
        isFirst && "border-t-0",
      )}
    >
      <RuleTypeDot type={rule.type} />
      <span className="truncate">{highlight(rule.value, query)}</span>
    </div>
  );
}

function RuleTypeDot({
  type,
}: {
  type: "allow" | "disallow" | "crawlDelay" | "contentSignal";
}) {
  const Icon =
    type === "allow"
      ? CircleCheck
      : type === "disallow"
        ? Ban
        : type === "crawlDelay"
          ? ClockFading
          : Signal;
  const label =
    type === "allow"
      ? "Allow"
      : type === "disallow"
        ? "Disallow"
        : type === "crawlDelay"
          ? "Crawl delay"
          : "Content signal";
  const colorClass =
    type === "allow"
      ? "text-accent-green"
      : type === "disallow"
        ? "text-destructive"
        : type === "crawlDelay"
          ? "text-accent-orange"
          : "text-accent-purple";
  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <div className="flex h-4 w-4 items-center justify-center">
            <Icon className={cn("size-3.5", colorClass)} aria-hidden />
          </div>
        }
      />
      <TooltipContent side="left" sideOffset={8}>
        {label}
      </TooltipContent>
    </Tooltip>
  );
}

function SitemapsList({ items }: { items: string[] }) {
  const { existing, added, more, total, visible, setVisible } =
    useProgressiveReveal(items, 2);
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 text-[11px] text-foreground/70 uppercase leading-none tracking-[0.08em] dark:text-foreground/80">
        <span>Sitemaps</span>
        <PillCount count={items.length} color="green" />
      </div>
      <div className="flex flex-col gap-2.5">
        {existing.map((u) => (
          <div key={`sm-ex-${u}`} className="flex items-center">
            <a
              className="flex items-center gap-1.5 truncate font-medium text-[13px] text-foreground/85 hover:text-foreground/60 hover:no-underline"
              href={u}
              target="_blank"
              rel="noopener"
            >
              {u}
              <ExternalLink className="size-3" />
            </a>
          </div>
        ))}
        {added.length > 0 ? (
          <motion.div
            key={`sitemaps-added-${visible}`}
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            transition={{ duration: 0.25, ease: "easeOut" }}
            style={{ overflow: "hidden" }}
            className="flex flex-col gap-2.5"
          >
            {added.map((u) => (
              <div key={`sm-add-${u}`} className="flex items-center">
                <a
                  className="flex items-center gap-1.5 truncate font-medium text-[13px] text-foreground/85 hover:text-foreground/60 hover:no-underline"
                  href={u}
                  target="_blank"
                  rel="noopener"
                >
                  {u}
                  <ExternalLink className="size-3" />
                </a>
              </div>
            ))}
          </motion.div>
        ) : null}
        {more > 0 ? (
          <div className="mt-1 flex justify-start">
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="text-[12px]"
              onClick={() => setVisible(total)}
            >
              <EllipsisVertical className="!h-3.5 !w-3.5" aria-hidden />
              <span>Show {more} more</span>
            </Button>
          </div>
        ) : null}
      </div>
    </div>
  );
}

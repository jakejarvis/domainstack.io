"use client";

import {
  Ban,
  ChevronRight,
  CircleCheck,
  ClockFading,
  EllipsisVertical,
  ExternalLink,
  FileQuestionMark,
  Filter,
  X,
} from "lucide-react";
import { motion } from "motion/react";
import { useCallback, useMemo, useState } from "react";
import {
  DiscordIcon,
  FacebookIcon,
  LinkedinIcon,
  SlackIcon,
  TwitterIcon,
} from "@/components/brand-icons";
import { KeyValue } from "@/components/domain/key-value";
import { KeyValueGrid } from "@/components/domain/key-value-grid";
import { Section } from "@/components/domain/section";
import { RedirectedAlert } from "@/components/domain/seo/redirected-alert";
import { SocialPreview } from "@/components/domain/seo/social-preview";
import { SubheadCount } from "@/components/domain/subhead-count";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Button } from "@/components/ui/button";
import { ButtonGroup } from "@/components/ui/button-group";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useProgressiveReveal } from "@/hooks/use-progressive-reveal";
import type { SeoResponse, SocialPreviewProvider } from "@/lib/schemas";
import { sections } from "@/lib/sections-meta";
import { cn } from "@/lib/utils";

export function SeoSection({
  domain,
  data,
}: {
  domain: string;
  data?: SeoResponse | null;
}) {
  const metaTagValues: { label: string; value?: string | null }[] = [
    { label: "Title", value: data?.preview?.title },
    { label: "Description", value: data?.preview?.description },
    { label: "Keywords", value: data?.meta?.general.keywords },
    { label: "Author", value: data?.meta?.general.author },
    { label: "Canonical", value: data?.preview?.canonicalUrl },
    { label: "Image", value: data?.preview?.image },
    { label: "Generator", value: data?.meta?.general.generator },
    { label: "Robots", value: data?.meta?.general.robots },
  ];
  const metaTagCount = metaTagValues.filter((t) => t.value != null).length;
  const hasAnySeoMeta = metaTagCount > 0;

  // Decide which X (Twitter) card variant to display based on meta tags.
  const twitterCard = data?.meta?.twitter?.card?.toLowerCase();
  const xVariant: "compact" | "large" =
    twitterCard === "summary_large_image"
      ? "large"
      : twitterCard === "summary"
        ? "compact"
        : data?.preview?.image
          ? "large"
          : "compact";

  // Single SocialPreview approach: control the active tab and render one preview.
  const [selectedTab, setSelectedTab] =
    useState<SocialPreviewProvider>("twitter");

  return (
    <Section {...sections.seo}>
      {hasAnySeoMeta ? (
        <div className="space-y-4">
          <RedirectedAlert
            domain={domain}
            finalUrl={data?.source?.finalUrl ?? undefined}
          />

          <div className="space-y-3">
            <div className="flex items-center gap-2 text-[11px] text-foreground/70 uppercase leading-none tracking-[0.08em] dark:text-foreground/80">
              <span>Meta Tags</span>
              <SubheadCount count={metaTagCount} color="orange" />
            </div>
            <KeyValueGrid colsDesktop={2}>
              {metaTagValues
                .filter((t) => t.value != null)
                .map((t) => (
                  <KeyValue
                    key={t.label}
                    label={t.label}
                    value={String(t.value)}
                    suffix={
                      String(t.value).startsWith("http://") ||
                      String(t.value).startsWith("https://") ? (
                        <a
                          href={String(t.value)}
                          target="_blank"
                          rel="noopener"
                          className="text-muted-foreground hover:text-foreground"
                          title="Open URL in new tab"
                        >
                          <ExternalLink
                            className="!h-3.5 !w-3.5"
                            aria-hidden="true"
                          />
                        </a>
                      ) : null
                    }
                    copyable
                  />
                ))}
            </KeyValueGrid>
          </div>

          <div className="mt-6 space-y-3">
            <div className="text-[11px] text-foreground/70 uppercase tracking-[0.08em] dark:text-foreground/80">
              Open Graph
            </div>
            <Tabs
              value={selectedTab}
              onValueChange={(v) => setSelectedTab(v as typeof selectedTab)}
            >
              <TabsList className="h-11 w-full gap-1 border border-muted-foreground/15 bg-muted/30 md:justify-start dark:bg-muted/50 dark:*:data-[state=active]:bg-accent">
                <TabsTrigger value="twitter">
                  <TwitterIcon
                    className="size-4 md:size-3.5"
                    aria-hidden="true"
                  />
                  <span className="hidden text-[13px] md:inline">Twitter</span>
                </TabsTrigger>
                <TabsTrigger value="facebook">
                  <FacebookIcon
                    className="size-4 md:size-3.5"
                    aria-hidden="true"
                  />
                  <span className="hidden text-[13px] md:inline">Facebook</span>
                </TabsTrigger>
                <TabsTrigger value="linkedin">
                  <LinkedinIcon
                    className="size-4 md:size-3.5"
                    aria-hidden="true"
                  />
                  <span className="hidden text-[13px] md:inline">LinkedIn</span>
                </TabsTrigger>
                <TabsTrigger value="discord">
                  <DiscordIcon
                    className="size-4 md:size-3.5"
                    aria-hidden="true"
                  />
                  <span className="hidden text-[13px] md:inline">Discord</span>
                </TabsTrigger>
                <TabsTrigger value="slack">
                  <SlackIcon
                    className="size-4 md:size-3.5"
                    aria-hidden="true"
                  />
                  <span className="hidden text-[13px] md:inline">Slack</span>
                </TabsTrigger>
              </TabsList>
              <div className="mx-auto mt-4 mb-2 w-full max-w-[480px] md:max-w-[640px]">
                <TabsContent
                  value={selectedTab}
                  className="grid place-items-center"
                >
                  {data?.preview ? (
                    <SocialPreview
                      provider={selectedTab}
                      title={data.preview.title}
                      description={data.preview.description}
                      image={data.preview.imageUploaded ?? null}
                      url={data.preview.canonicalUrl}
                      variant={selectedTab === "twitter" ? xVariant : undefined}
                    />
                  ) : null}
                </TabsContent>
              </div>
            </Tabs>
          </div>

          <RobotsSummary domain={domain} robots={data?.robots ?? null} />
        </div>
      ) : (
        <Empty className="border border-dashed">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <FileQuestionMark />
            </EmptyMedia>
            <EmptyTitle>No SEO meta detected</EmptyTitle>
            <EmptyDescription>
              We didn&apos;t find standard SEO meta tags (title, description,
              canonical, or open graph). Add them to improve link previews.
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      )}
    </Section>
  );
}

function RobotsSummary({
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
        rules: { type: "allow" | "disallow" | "crawlDelay"; value: string }[];
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
        <SubheadCount
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
                        <X />
                      </InputGroupButton>
                    </InputGroupAddon>
                  ) : null}
                </InputGroup>

                <ButtonGroup className="!w-full sm:!w-auto h-9 items-stretch [&>*]:flex-1 sm:[&>*]:flex-none">
                  <Button
                    type="button"
                    variant="outline"
                    aria-pressed={only === "all"}
                    onClick={() => setOnly("all")}
                    className={cn(
                      "h-9 px-3 text-[13px] hover:bg-muted/30 dark:hover:bg-accent/50",
                      only === "all" && "!bg-muted/50 dark:!bg-accent",
                    )}
                  >
                    All
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    aria-pressed={only === "allow"}
                    onClick={() => setOnly("allow")}
                    className={cn(
                      "h-9 gap-2 px-3 text-[13px] hover:bg-muted/30 dark:hover:bg-accent/50",
                      only === "allow" && "!bg-muted/50 dark:!bg-accent",
                    )}
                  >
                    <CircleCheck
                      className="size-3.5 text-emerald-500"
                      aria-hidden="true"
                    />
                    <span>Allow</span>
                    <SubheadCount count={counts.allows} color="slate" />
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    aria-pressed={only === "disallow"}
                    onClick={() => setOnly("disallow")}
                    className={cn(
                      "h-9 gap-2 px-3 text-[13px] hover:bg-muted/30 dark:hover:bg-accent/50",
                      only === "disallow" && "!bg-muted/50 dark:!bg-accent",
                    )}
                  >
                    <Ban
                      className="size-3.5 text-rose-500"
                      aria-hidden="true"
                    />
                    <span>Disallow</span>
                    <SubheadCount count={counts.disallows} color="slate" />
                  </Button>
                </ButtonGroup>
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
    <div className="flex w-full items-center justify-between rounded-md p-1.5 hover:bg-accent/35">
      <div className="flex flex-wrap items-center gap-1.5">
        <ChevronRight className="size-3 text-muted-foreground transition-transform group-data-[state=open]/accordion:rotate-90" />
        {userAgents.map((ua) => (
          <span
            key={ua}
            className={cn(
              "rounded px-1.5 py-0.5 text-xs",
              ua === "*"
                ? "bg-accent-purple/18 text-accent-purple"
                : "bg-muted",
            )}
          >
            {ua === "*" ? "All" : ua}
          </span>
        ))}
      </div>
      <div className="mr-1 text-muted-foreground text-xs">
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
    rules: { type: "allow" | "disallow" | "crawlDelay"; value: string }[];
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
        <AccordionTrigger className="group/accordion py-2 hover:no-underline [&>svg]:hidden">
          <RobotsGroupHeader
            userAgents={g.userAgents}
            allowN={allowN}
            disallowN={disallowN}
            showAllow={showAllow}
            showDisallow={showDisallow}
          />
        </AccordionTrigger>
        <AccordionContent>
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
    <Accordion type="multiple" value={openValues as string[]}>
      {content}
    </Accordion>
  ) : (
    <Accordion type="single" collapsible defaultValue={defaultValue}>
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
  rules: { type: "allow" | "disallow" | "crawlDelay"; value: string }[];
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
      <div className="flex flex-col gap-1.5">
        {rules.map((r, i) => (
          <RuleRow
            key={`r-${r.type}-${r.value}-all-${i}`}
            rule={r}
            query={query}
            highlight={highlight}
          />
        ))}
      </div>
    );
  }
  return (
    <div className="flex flex-col gap-1.5 py-2">
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
        />
      ))}
      {added.length > 0 ? (
        <motion.div
          key={`added-${visible}`}
          initial={{ height: 0, opacity: 0 }}
          animate={{ height: "auto", opacity: 1 }}
          transition={{ duration: 0.25, ease: "easeOut" }}
          style={{ overflow: "hidden" }}
          className="flex flex-col gap-1.5"
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
}: {
  rule: { type: "allow" | "disallow" | "crawlDelay"; value: string };
  query: string;
  highlight: (text: string, q: string) => React.ReactNode;
}) {
  return (
    <div className="group flex items-center gap-2 rounded-lg border border-input px-2.5 py-2 font-mono text-xs">
      <RuleTypeDot type={rule.type} />
      <span className="truncate">{highlight(rule.value, query)}</span>
    </div>
  );
}

function RuleTypeDot({ type }: { type: "allow" | "disallow" | "crawlDelay" }) {
  const Icon =
    type === "allow" ? CircleCheck : type === "disallow" ? Ban : ClockFading;
  const label =
    type === "allow"
      ? "Allow"
      : type === "disallow"
        ? "Disallow"
        : "Crawl delay";
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <div className="flex h-4 w-4 items-center justify-center">
          <Icon
            className={cn(
              "size-3.5",
              type === "allow"
                ? "text-emerald-500"
                : type === "disallow"
                  ? "text-rose-500"
                  : "text-amber-500",
            )}
            aria-hidden
          />
        </div>
      </TooltipTrigger>
      <TooltipContent side="left">{label}</TooltipContent>
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
        <SubheadCount count={items.length} color="green" />
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

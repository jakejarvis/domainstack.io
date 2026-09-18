import { IconHelp } from "@tabler/icons-react";

import { PillCount } from "@/components/domain/pill-count";
import { ReportSection } from "@/components/domain/report-section";
import { Favicon } from "@/components/icons/favicon";
import { sections } from "@/lib/constants/sections";
import type {
  DetectedTechnology,
  TechnologiesResponse,
  TechnologyCategory,
} from "@domainstack/types";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@domainstack/ui/empty";
import {
  ResponsiveTooltip,
  ResponsiveTooltipContent,
  ResponsiveTooltipTrigger,
} from "@domainstack/ui/responsive-tooltip";

// Display order and human-readable labels. A new entry in
// TECHNOLOGY_CATEGORIES fails to compile here until it gets a label.
const CATEGORY_LABELS: Record<TechnologyCategory, string> = {
  cms: "CMS",
  ecommerce: "Ecommerce",
  framework: "Frameworks",
  "javascript-library": "JavaScript Libraries",
  "web-server": "Web Servers",
  "programming-language": "Programming Languages",
  cdn: "CDNs",
  hosting: "Hosting",
  analytics: "Analytics",
  "tag-manager": "Tag Managers",
  marketing: "Marketing",
  payment: "Payment",
  security: "Security",
  "live-chat": "Live Chat",
  "font-script": "Fonts & Scripts",
  "error-tracking": "Error Tracking",
  verification: "Verification",
  other: "Other",
};

const CATEGORY_ORDER = Object.keys(CATEGORY_LABELS) as TechnologyCategory[];

function groupByCategory(
  technologies: DetectedTechnology[],
): { category: TechnologyCategory; items: DetectedTechnology[] }[] {
  const groups = new Map<TechnologyCategory, DetectedTechnology[]>();
  for (const tech of technologies) {
    for (const category of tech.categories) {
      const list = groups.get(category) ?? [];
      list.push(tech);
      groups.set(category, list);
    }
  }
  return CATEGORY_ORDER.filter((category) => groups.has(category)).map((category) => ({
    category,
    items: groups.get(category) ?? [],
  }));
}

function TechnologyRow({ tech }: { tech: DetectedTechnology }) {
  const row = (
    <div className="flex h-10 min-w-0 items-center gap-2 rounded-lg border border-border bg-background/60 px-3 backdrop-blur-lg">
      {tech.iconDomain ? (
        <Favicon domain={tech.iconDomain} size={16} />
      ) : (
        <span aria-hidden className="size-4 shrink-0 rounded bg-muted" />
      )}
      <span className="min-w-0 flex-1 truncate text-[13px] text-foreground/95">{tech.name}</span>
      {tech.version && (
        <span className="shrink-0 font-mono text-[11px] text-muted-foreground tabular-nums">
          {tech.version}
        </span>
      )}
      {tech.implied && <span className="shrink-0 text-[11px] text-muted-foreground">implied</span>}
    </div>
  );

  if (!tech.implied) {
    return row;
  }

  return (
    <ResponsiveTooltip>
      <ResponsiveTooltipTrigger nativeButton={false} render={<div>{row}</div>} />
      <ResponsiveTooltipContent>
        Not detected directly — implied by another technology on this page.
      </ResponsiveTooltipContent>
    </ResponsiveTooltip>
  );
}

function CategoryGroup({
  category,
  items,
}: {
  category: TechnologyCategory;
  items: DetectedTechnology[];
}) {
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2 text-[11px] leading-none tracking-[0.08em] text-foreground/70 uppercase dark:text-foreground/80">
        <span>{CATEGORY_LABELS[category]}</span>
        <PillCount count={items.length} color="indigo" />
      </div>
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {items.map((tech) => (
          <TechnologyRow key={`${category}-${tech.slug}`} tech={tech} />
        ))}
      </div>
    </div>
  );
}

function EmptyTechnologies({ error }: { error?: string }) {
  return (
    <Empty className="border border-dashed">
      <EmptyHeader>
        <EmptyMedia variant="icon">
          <IconHelp />
        </EmptyMedia>
        <EmptyTitle>No technologies detected</EmptyTitle>
        <EmptyDescription>
          We look for known frameworks, CMS platforms, and scripts in the page&apos;s HTML, headers,
          cookies, and DNS records. A site can use technologies we can&apos;t see from the outside —
          single-page apps in particular often leave no static trace.
          {error && <> ({error})</>}
        </EmptyDescription>
      </EmptyHeader>
    </Empty>
  );
}

export function TechnologiesSection({
  data,
}: {
  domain?: string;
  data?: TechnologiesResponse | null;
}) {
  const technologies = data?.technologies ?? [];
  const groups = groupByCategory(technologies);

  if (groups.length === 0) {
    return (
      <ReportSection {...sections.technologies}>
        <EmptyTechnologies error={data?.error} />
      </ReportSection>
    );
  }

  return (
    <ReportSection {...sections.technologies}>
      <div className="space-y-4">
        {data?.error && (
          <p className="text-[11px] text-muted-foreground">
            Some technologies may be missing: {data.error}
          </p>
        )}
        {groups.map(({ category, items }) => (
          <CategoryGroup key={category} category={category} items={items} />
        ))}
      </div>
    </ReportSection>
  );
}

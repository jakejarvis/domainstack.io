import { IconAlertTriangle, IconHelp } from "@tabler/icons-react";

import { ReportSection } from "@/components/domain/report-section";
import { MetaTagsGrid } from "@/components/domain/seo/meta-tags-grid";
import { RedirectedAlert } from "@/components/domain/seo/redirected-alert";
import { RobotsSummary } from "@/components/domain/seo/robots-summary";
import { SocialPreviews } from "@/components/domain/seo/social-previews";
import { sections } from "@/lib/constants/sections";
import type { SeoResponse } from "@domainstack/types";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@domainstack/ui/empty";

function resolveTwitterVariant(data?: SeoResponse | null): "compact" | "large" {
  const twitterCard = data?.meta?.twitter?.card?.toLowerCase();
  if (twitterCard === "summary_large_image") return "large";
  if (twitterCard === "summary") return "compact";
  return data?.preview?.image ? "large" : "compact";
}

function SeoEmpty({
  icon: Icon,
  title,
  description,
}: {
  icon: typeof IconHelp;
  title: string;
  description: string;
}) {
  return (
    <Empty className="border border-dashed">
      <EmptyHeader>
        <EmptyMedia variant="icon">
          <Icon />
        </EmptyMedia>
        <EmptyTitle>{title}</EmptyTitle>
        <EmptyDescription>{description}</EmptyDescription>
      </EmptyHeader>
    </Empty>
  );
}

function SeoMetaBlock({
  domain,
  data,
  metaTagValues,
  hasHtmlError,
  hasAnySeoMeta,
}: {
  domain: string;
  data?: SeoResponse | null;
  metaTagValues: { label: string; value?: string | null }[];
  hasHtmlError: boolean;
  hasAnySeoMeta: boolean;
}) {
  if (hasHtmlError) {
    return (
      <SeoEmpty
        icon={IconAlertTriangle}
        title="Couldn't fetch page meta"
        description="We weren't able to retrieve the HTML for this page to extract its meta tags."
      />
    );
  }

  if (!hasAnySeoMeta) {
    return (
      <SeoEmpty
        icon={IconHelp}
        title="No SEO meta detected"
        description="We didn't find standard SEO meta tags (title, description, canonical, or open graph). Add them to improve link previews."
      />
    );
  }

  return (
    <>
      <RedirectedAlert domain={domain} finalUrl={data?.source?.finalUrl ?? undefined} />
      <MetaTagsGrid metaTagValues={metaTagValues} />
      {data?.preview ? (
        <SocialPreviews preview={data.preview} twitterVariant={resolveTwitterVariant(data)} />
      ) : null}
    </>
  );
}

function RobotsBlock({
  domain,
  robots,
  hasRobotsData,
}: {
  domain: string;
  robots: SeoResponse["robots"] | undefined;
  hasRobotsData: boolean;
}) {
  if (hasRobotsData && robots) {
    return <RobotsSummary domain={domain} robots={robots} />;
  }

  return (
    <>
      <div className="mt-5 text-[11px] leading-none tracking-[0.08em] text-foreground/70 uppercase dark:text-foreground/80">
        robots.txt
      </div>
      <SeoEmpty
        icon={IconHelp}
        title="No robots.txt found"
        description="We didn't find a robots.txt for this site. Crawlers will use default behavior until one is added."
      />
    </>
  );
}

export function SeoSection({ domain, data }: { domain: string; data?: SeoResponse | null }) {
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
  const hasAnySeoMeta = metaTagValues.filter((t) => t.value != null).length > 0;
  const hasHtmlError = Boolean(data?.errors?.html);
  const hasRobotsData = Boolean(
    data?.robots?.fetched &&
    ((data.robots.groups?.length ?? 0) > 0 || (data.robots.sitemaps?.length ?? 0) > 0),
  );

  if (hasHtmlError && !hasRobotsData) {
    return null;
  }

  return (
    <ReportSection {...sections.seo}>
      <div className="space-y-4">
        <SeoMetaBlock
          domain={domain}
          data={data}
          metaTagValues={metaTagValues}
          hasHtmlError={hasHtmlError}
          hasAnySeoMeta={hasAnySeoMeta}
        />
        <RobotsBlock domain={domain} robots={data?.robots} hasRobotsData={hasRobotsData} />
      </div>
    </ReportSection>
  );
}

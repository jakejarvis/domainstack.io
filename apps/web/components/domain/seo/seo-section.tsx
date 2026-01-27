import type { SeoResponse } from "@domainstack/types";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@domainstack/ui/empty";
import { IconAlertTriangle, IconHelp } from "@tabler/icons-react";
import { ReportSection } from "@/components/domain/report-section";
import { MetaTagsGrid } from "@/components/domain/seo/meta-tags-grid";
import { RedirectedAlert } from "@/components/domain/seo/redirected-alert";
import { RobotsSummary } from "@/components/domain/seo/robots-summary";
import { SocialPreviews } from "@/components/domain/seo/social-previews";
import { sections } from "@/lib/constants/sections";

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
  const hasHtmlError = Boolean(data?.errors?.html);
  // Check for meaningful robots data (fetched successfully with actual content)
  const hasRobotsData = Boolean(
    data?.robots?.fetched &&
      ((data.robots.groups?.length ?? 0) > 0 ||
        (data.robots.sitemaps?.length ?? 0) > 0),
  );

  // If HTML failed and no meaningful robots data, nothing to show
  if (hasHtmlError && !hasRobotsData) {
    return null;
  }

  // Decide which X (Twitter) card variant to display based on meta tags.
  const twitterCard = data?.meta?.twitter?.card?.toLowerCase();
  const twitterVariant: "compact" | "large" =
    twitterCard === "summary_large_image"
      ? "large"
      : twitterCard === "summary"
        ? "compact"
        : data?.preview?.image
          ? "large"
          : "compact";

  return (
    <ReportSection {...sections.seo}>
      <div className="space-y-4">
        {hasHtmlError ? (
          // HTML fetch failed but we have robots data to show
          <Empty className="border border-dashed">
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <IconAlertTriangle />
              </EmptyMedia>
              <EmptyTitle>Couldn&apos;t fetch page meta</EmptyTitle>
              <EmptyDescription>
                We weren&apos;t able to retrieve the HTML for this page to
                extract its meta tags.
              </EmptyDescription>
            </EmptyHeader>
          </Empty>
        ) : hasAnySeoMeta ? (
          <>
            <RedirectedAlert
              domain={domain}
              finalUrl={data?.source?.finalUrl ?? undefined}
            />

            <MetaTagsGrid metaTagValues={metaTagValues} />

            {data?.preview ? (
              <SocialPreviews
                preview={data.preview}
                twitterVariant={twitterVariant}
              />
            ) : null}
          </>
        ) : (
          <Empty className="border border-dashed">
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <IconHelp />
              </EmptyMedia>
              <EmptyTitle>No SEO meta detected</EmptyTitle>
              <EmptyDescription>
                We didn&apos;t find standard SEO meta tags (title, description,
                canonical, or open graph). Add them to improve link previews.
              </EmptyDescription>
            </EmptyHeader>
          </Empty>
        )}

        {hasRobotsData && data?.robots ? (
          <RobotsSummary domain={domain} robots={data.robots} />
        ) : (
          <>
            <div className="mt-5 text-[11px] text-foreground/70 uppercase leading-none tracking-[0.08em] dark:text-foreground/80">
              robots.txt
            </div>
            <Empty className="border border-dashed">
              <EmptyHeader>
                <EmptyMedia variant="icon">
                  <IconHelp />
                </EmptyMedia>
                <EmptyTitle>No robots.txt found</EmptyTitle>
                <EmptyDescription>
                  We didn&apos;t find a robots.txt for this site. Crawlers will
                  use default behavior until one is added.
                </EmptyDescription>
              </EmptyHeader>
            </Empty>
          </>
        )}
      </div>
    </ReportSection>
  );
}

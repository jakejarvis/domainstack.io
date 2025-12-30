import { FileQuestionMark } from "lucide-react";
import { Section } from "@/components/domain/section";
import { MetaTagsGrid } from "@/components/domain/seo/meta-tags-grid";
import { RedirectedAlert } from "@/components/domain/seo/redirected-alert";
import { RobotsSummary } from "@/components/domain/seo/robots-summary";
import { SocialPreviewTabs } from "@/components/domain/seo/social-preview-tabs";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { sections } from "@/lib/constants/sections";
import type { SeoResponse } from "@/lib/schemas";

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
  const twitterVariant: "compact" | "large" =
    twitterCard === "summary_large_image"
      ? "large"
      : twitterCard === "summary"
        ? "compact"
        : data?.preview?.image
          ? "large"
          : "compact";

  if (data?.errors?.html) {
    return null;
  }

  return (
    <Section {...sections.seo}>
      {hasAnySeoMeta ? (
        <div className="space-y-4">
          <RedirectedAlert
            domain={domain}
            finalUrl={data?.source?.finalUrl ?? undefined}
          />

          <MetaTagsGrid metaTagValues={metaTagValues} />

          {data?.preview ? (
            <SocialPreviewTabs
              preview={data.preview}
              twitterVariant={twitterVariant}
            />
          ) : null}

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

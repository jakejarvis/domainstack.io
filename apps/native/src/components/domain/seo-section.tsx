import { Plural, Trans, useLingui } from "@lingui/react/macro";
import { useSuspenseQuery } from "@tanstack/react-query";
import { Image } from "expo-image";
import { View } from "react-native";

import { Badge } from "@/components/badge";
import { KeyValueGrid, type KeyValueItem } from "@/components/key-value-grid";
import { ReportSection } from "@/components/report-section";
import { Text } from "@/components/text";
import { useTRPC } from "@/lib/api";

export function SeoSection({ domain }: { domain: string }) {
  const { t } = useLingui();
  const trpc = useTRPC();
  const { data } = useSuspenseQuery(trpc.domain.getSeo.queryOptions({ domain }));

  if (!data.success || !data.data) {
    return (
      <ReportSection
        accent="cyan"
        icon={{ android: "query_stats", ios: "chart.bar.doc.horizontal" }}
        subtitle="Meta · OG · robots"
        title={t`SEO`}
      >
        <Text className="text-sm text-muted-foreground">
          <Trans>SEO data could not be retrieved.</Trans>
        </Text>
      </ReportSection>
    );
  }

  const { meta, robots, preview, source } = data.data;
  const items: KeyValueItem[] = [];
  if (meta?.general.title) items.push({ key: "title", label: t`Title`, value: meta.general.title });
  if (meta?.general.description)
    items.push({ key: "description", label: t`Description`, value: meta.general.description });
  if (meta?.general.canonical)
    items.push({
      key: "canonical",
      label: t`Canonical`,
      value: meta.general.canonical,
      mono: true,
    });
  if (meta?.general.robots)
    items.push({ key: "robots", label: t`Robots`, value: meta.general.robots, mono: true });
  if (source.finalUrl && source.finalUrl !== `https://${domain}/`)
    items.push({ key: "final-url", label: t`Final URL`, value: source.finalUrl, mono: true });

  const previewImage = preview?.image ?? preview?.imageUploaded ?? null;

  return (
    <ReportSection
      accent="cyan"
      icon={{ android: "query_stats", ios: "chart.bar.doc.horizontal" }}
      subtitle="Meta · OG · robots"
      title={t`SEO`}
      trailing={
        source.status ? (
          <Badge variant={source.status >= 200 && source.status < 400 ? "success" : "warning"}>
            <Text className="text-xs font-semibold">HTTP {source.status}</Text>
          </Badge>
        ) : undefined
      }
    >
      {items.length > 0 ? <KeyValueGrid items={items} /> : null}
      {previewImage ? (
        <View className="overflow-hidden rounded-lg border border-border">
          <Image
            cachePolicy="memory-disk"
            contentFit="cover"
            recyclingKey={previewImage}
            source={{ uri: previewImage }}
            style={{ aspectRatio: 1200 / 630, width: "100%" }}
            transition={200}
          />
        </View>
      ) : null}
      {robots && robots.groups.length > 0 ? (
        <View className="gap-1">
          <Text variant="footnote" className="text-muted-foreground">
            robots.txt
          </Text>
          <Text className="font-mono text-xs">
            <Plural value={robots.groups.length} one="# group" other="# groups" />
            {robots.sitemaps.length > 0 ? (
              <Plural value={robots.sitemaps.length} one=" · # sitemap" other=" · # sitemaps" />
            ) : null}
          </Text>
        </View>
      ) : null}
    </ReportSection>
  );
}

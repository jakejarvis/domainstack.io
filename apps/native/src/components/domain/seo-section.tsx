import { useSuspenseQuery } from "@tanstack/react-query";
import { Image } from "expo-image";
import { View } from "react-native";

import { Badge } from "@/components/badge";
import { KeyValueGrid, type KeyValueItem } from "@/components/key-value-grid";
import { ReportSection } from "@/components/report-section";
import { Text } from "@/components/text";
import { useTRPC } from "@/lib/api";

export function SeoSection({ domain }: { domain: string }) {
  const trpc = useTRPC();
  const { data } = useSuspenseQuery(trpc.domain.getSeo.queryOptions({ domain }));

  if (!data.success || !data.data) {
    return (
      <ReportSection
        accent="cyan"
        icon={{ android: "query_stats", ios: "chart.bar.doc.horizontal" }}
        subtitle="Meta · OG · robots"
        title="SEO"
      >
        <Text className="text-sm text-muted-foreground">SEO data could not be retrieved.</Text>
      </ReportSection>
    );
  }

  const { meta, robots, preview, source } = data.data;
  const items: KeyValueItem[] = [];
  if (meta?.general.title) items.push({ key: "title", label: "Title", value: meta.general.title });
  if (meta?.general.description)
    items.push({ key: "description", label: "Description", value: meta.general.description });
  if (meta?.general.canonical)
    items.push({ key: "canonical", label: "Canonical", value: meta.general.canonical, mono: true });
  if (meta?.general.robots)
    items.push({ key: "robots", label: "Robots", value: meta.general.robots, mono: true });
  if (source.finalUrl && source.finalUrl !== `https://${domain}/`)
    items.push({ key: "final-url", label: "Final URL", value: source.finalUrl, mono: true });

  const previewImage = preview?.image ?? preview?.imageUploaded ?? null;

  return (
    <ReportSection
      accent="cyan"
      icon={{ android: "query_stats", ios: "chart.bar.doc.horizontal" }}
      subtitle="Meta · OG · robots"
      title="SEO"
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
            {robots.groups.length} group{robots.groups.length === 1 ? "" : "s"}
            {robots.sitemaps.length > 0 ? ` · ${robots.sitemaps.length} sitemap(s)` : ""}
          </Text>
        </View>
      ) : null}
    </ReportSection>
  );
}

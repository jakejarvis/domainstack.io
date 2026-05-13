import { useSuspenseQuery } from "@tanstack/react-query";
import { Image } from "expo-image";
import { View } from "react-native";

import { Badge } from "@/components/badge";
import { KeyValueGrid, type KeyValueItem } from "@/components/key-value-grid";
import { ReportSection } from "@/components/report-section";
import { MutedText, Text } from "@/components/text";
import { useTRPC } from "@/lib/api";

export function SeoSection({ domain }: { domain: string }) {
  const trpc = useTRPC();
  const { data } = useSuspenseQuery(trpc.domain.getSeo.queryOptions({ domain }));

  if (!data.success || !data.data) {
    return (
      <ReportSection title="SEO">
        <MutedText>SEO data could not be retrieved.</MutedText>
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
      title="SEO"
      trailing={
        source.status ? (
          <Badge tone={source.status >= 200 && source.status < 400 ? "success" : "warning"}>
            <Text className="text-xs font-semibold">HTTP {source.status}</Text>
          </Badge>
        ) : undefined
      }
    >
      {items.length > 0 ? <KeyValueGrid items={items} /> : null}
      {previewImage ? (
        <View className="border-line overflow-hidden rounded-lg border">
          <Image
            contentFit="cover"
            source={{ uri: previewImage }}
            style={{ aspectRatio: 1200 / 630, width: "100%" }}
          />
        </View>
      ) : null}
      {robots && robots.groups.length > 0 ? (
        <View className="gap-1">
          <MutedText className="text-xs tracking-wide uppercase">robots.txt</MutedText>
          <Text className="font-mono text-xs">
            {robots.groups.length} group{robots.groups.length === 1 ? "" : "s"}
            {robots.sitemaps.length > 0 ? ` · ${robots.sitemaps.length} sitemap(s)` : ""}
          </Text>
        </View>
      ) : null}
    </ReportSection>
  );
}

import { useQuery } from "@tanstack/react-query";
import { Image } from "expo-image";
import { View } from "react-native";

import { useTRPC } from "@/lib/api";

const SIZE = 32;

export function Favicon({ domain }: { domain: string }) {
  const trpc = useTRPC();
  const { data } = useQuery(trpc.domain.getFavicon.queryOptions({ domain }));
  const url = data?.data?.url ?? null;

  return (
    <View
      accessibilityElementsHidden
      className="overflow-hidden rounded-md border border-border bg-secondary"
      importantForAccessibility="no-hide-descendants"
      style={{ height: SIZE, width: SIZE }}
    >
      {url ? (
        <Image
          accessible={false}
          cachePolicy="memory-disk"
          contentFit="cover"
          recyclingKey={domain}
          source={{ uri: url }}
          style={{ height: SIZE, width: SIZE }}
          transition={150}
        />
      ) : null}
    </View>
  );
}

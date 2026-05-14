import { useQuery } from "@tanstack/react-query";
import { Image } from "expo-image";
import { View } from "react-native";

import { Text } from "@/components/text";
import { useTRPC } from "@/lib/api";
import { simpleHash } from "@domainstack/utils";

const PLACEHOLDER_COLORS = [
  "#3b82f6",
  "#a855f7",
  "#ec4899",
  "#f43f5e",
  "#f97316",
  "#f59e0b",
  "#10b981",
  "#14b8a6",
  "#06b6d4",
  "#6366f1",
  "#8b5cf6",
  "#d946ef",
] as const;

export function ProviderLogo({
  providerId,
  providerName,
  size = 14,
}: {
  providerId: string | null | undefined;
  providerName: string | null | undefined;
  size?: number;
}) {
  const trpc = useTRPC();
  const enabled = Boolean(providerId);
  const query = useQuery({
    ...trpc.provider.getProviderIcon.queryOptions(
      { providerId: providerId ?? "" },
      { staleTime: Number.POSITIVE_INFINITY },
    ),
    enabled,
    refetchOnMount: false,
    refetchOnReconnect: false,
    refetchOnWindowFocus: false,
    retry: false,
  });

  const url = query.data?.data?.url ?? null;
  if (url) {
    return (
      <Image
        cachePolicy="memory-disk"
        contentFit="contain"
        recyclingKey={providerId ?? undefined}
        source={{ uri: url }}
        style={{ borderRadius: 3, height: size, width: size }}
        transition={150}
      />
    );
  }

  const identifier = providerName ?? "?";
  const letter = identifier[0]?.toUpperCase() ?? "?";
  const bg = PLACEHOLDER_COLORS[simpleHash(identifier) % PLACEHOLDER_COLORS.length];

  return (
    <View
      style={{
        alignItems: "center",
        backgroundColor: bg,
        borderRadius: 3,
        height: size,
        justifyContent: "center",
        width: size,
      }}
    >
      <Text
        style={{
          color: "white",
          fontSize: Math.max(8, Math.floor(size * 0.6)),
          fontWeight: "700",
          lineHeight: size,
        }}
      >
        {letter}
      </Text>
    </View>
  );
}

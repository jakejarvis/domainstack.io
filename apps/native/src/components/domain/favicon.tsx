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
      className="border-line bg-control-secondary overflow-hidden rounded-md border"
      style={{ height: SIZE, width: SIZE }}
    >
      {url ? (
        <Image contentFit="cover" source={{ uri: url }} style={{ height: SIZE, width: SIZE }} />
      ) : null}
    </View>
  );
}

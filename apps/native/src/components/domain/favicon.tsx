import { useQuery } from "@tanstack/react-query";
import { Image } from "expo-image";
import { useState } from "react";
import { Text, View } from "react-native";

import { useTRPC } from "@/lib/api";

// Deterministic gradient pair + initial, mirroring the web/design favicon
// fallback so a missing icon still reads as the domain rather than a blank.
const PALETTE: [string, string][] = [
  ["#4285f4", "#34a853"],
  ["#1da1f2", "#0a66c2"],
  ["#ff4500", "#ff7a59"],
  ["#1e293b", "#475569"],
  ["#c1272d", "#ee7752"],
  ["#0070f3", "#7928ca"],
  ["#0f766e", "#22c55e"],
  ["#a855f7", "#ec4899"],
  ["#f59e0b", "#ef4444"],
];

function gradientFor(domain: string): [string, string] {
  let h = 0;
  for (let i = 0; i < domain.length; i += 1) h = (h * 31 + domain.charCodeAt(i)) >>> 0;
  return PALETTE[h % PALETTE.length];
}

export function Favicon({ domain, size = 32 }: { domain: string; size?: number }) {
  const trpc = useTRPC();
  const { data } = useQuery(trpc.domain.getFavicon.queryOptions({ domain }));
  const url = data?.data?.url ?? null;
  const [errored, setErrored] = useState(false);
  const radius = Math.round(size * 0.22);
  const [from, to] = gradientFor(domain);
  const letter = (domain[0] ?? "?").toUpperCase();

  return (
    <View
      accessibilityElementsHidden
      className="overflow-hidden border border-border"
      importantForAccessibility="no-hide-descendants"
      style={{ borderCurve: "continuous", borderRadius: radius, height: size, width: size }}
    >
      {url && !errored ? (
        <Image
          accessible={false}
          cachePolicy="memory-disk"
          contentFit="cover"
          onError={() => setErrored(true)}
          recyclingKey={domain}
          source={{ uri: url }}
          style={{ height: size, width: size }}
          transition={150}
        />
      ) : (
        <View
          style={{
            alignItems: "center",
            backgroundColor: from,
            experimental_backgroundImage: `linear-gradient(135deg, ${from}, ${to})`,
            height: size,
            justifyContent: "center",
            width: size,
          }}
        >
          <Text
            style={{
              color: "#ffffff",
              fontFamily: "Geist",
              fontSize: Math.round(size * 0.52),
              fontWeight: "700",
            }}
          >
            {letter}
          </Text>
        </View>
      )}
    </View>
  );
}

import { Suspense } from "react";
import { View } from "react-native";

import { GlassCard } from "@/components/glass-card";
import { Text } from "@/components/text";
import { NONPUBLIC_TLDS } from "@domainstack/constants";
import { extractTldClient } from "@domainstack/utils/domain/client";

import { RegistrarLinks } from "./registrar-links";

export function UnregisteredCard({ domain }: { domain: string }) {
  const lower = domain.toLowerCase();
  const isNonPublic = NONPUBLIC_TLDS.some((suffix) => lower.endsWith(suffix));
  const tld = extractTldClient(domain);
  const canShowRegistrarLinks = !isNonPublic && tld;

  return (
    <GlassCard>
      <View className="items-center gap-2">
        <Text className="text-2xl font-semibold" numberOfLines={1}>
          {domain}
        </Text>
        <Text className="text-sm text-muted-foreground">appears to be unregistered…</Text>
      </View>
      {canShowRegistrarLinks ? (
        <Suspense fallback={null}>
          <RegistrarLinks domain={domain} tld={tld} />
        </Suspense>
      ) : null}
    </GlassCard>
  );
}

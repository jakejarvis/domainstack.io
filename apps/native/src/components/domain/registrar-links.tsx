import { Trans } from "@lingui/react/macro";
import { useSuspenseQuery } from "@tanstack/react-query";
import * as Linking from "expo-linking";
import { Pressable, View } from "react-native";

import { Text } from "@/components/text";
import { analytics } from "@/lib/analytics";
import { useTRPC } from "@/lib/api";
import { REGISTRAR_PROVIDERS, type RegistrarKey } from "@domainstack/constants";
import { formatPrice } from "@domainstack/utils";

export function RegistrarLinks({ domain, tld }: { domain: string; tld: string }) {
  const trpc = useTRPC();
  const { data } = useSuspenseQuery({
    ...trpc.registrar.getPricing.queryOptions({ tld }),
    staleTime: Number.POSITIVE_INFINITY,
  });

  const providers = data.data?.providers ?? [];
  if (providers.length === 0) return null;

  const sorted = providers
    .filter((p) => REGISTRAR_PROVIDERS[p.provider as RegistrarKey])
    .sort((a, b) => Number.parseFloat(a.price) - Number.parseFloat(b.price));

  if (sorted.length === 0) return null;

  return (
    <View className="gap-2">
      <Text className="text-center text-xs text-muted-foreground">
        <Trans>Register this domain</Trans>
      </Text>
      <View className="gap-2">
        {sorted.map((entry) => {
          const config = REGISTRAR_PROVIDERS[entry.provider as RegistrarKey];
          const price = formatPrice(entry.price);
          if (!config || !price) return null;
          return (
            <Pressable
              accessibilityRole="button"
              className="flex-row items-center justify-between gap-3 rounded-xl border border-border bg-secondary px-4 py-3"
              key={entry.provider}
              onPress={() => {
                analytics.track("registrar_referral_clicked", { registrar: entry.provider });
                void Linking.openURL(config.searchUrl(domain));
              }}
            >
              <Text className="font-semibold">{config.name}</Text>
              <Text className="text-sm text-muted-foreground">
                <Text className="font-semibold">{price}</Text>
                <Text className="text-xs text-muted-foreground">
                  <Trans>/year</Trans>
                </Text>
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

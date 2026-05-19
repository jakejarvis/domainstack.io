import { Trans } from "@lingui/react/macro";
import { Suspense } from "react";
import { View } from "react-native";

import { Card } from "@/components/card";
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
    <Card>
      <View className="items-center gap-2">
        <Text className="text-2xl font-semibold" numberOfLines={1}>
          {domain}
        </Text>
        <Text className="text-sm text-muted-foreground">
          <Trans>appears to be unregistered…</Trans>
        </Text>
      </View>
      {canShowRegistrarLinks ? (
        <Suspense fallback={null}>
          <RegistrarLinks domain={domain} tld={tld} />
        </Suspense>
      ) : null}
    </Card>
  );
}

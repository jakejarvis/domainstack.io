import { memo, useCallback } from "react";
import { Pressable, View } from "react-native";

import { daysUntil, formatDate } from "@/lib/format";
import type { PortfolioDomain } from "@/lib/portfolio";

import { Badge } from "./badge";
import { GlassCard } from "./glass-card";
import { MutedText, Text } from "./text";

function DomainRowImpl({
  domain,
  onPress,
}: {
  domain: PortfolioDomain;
  onPress: (id: string) => void;
}) {
  const days = daysUntil(domain.expirationDate);
  const expiryTone =
    days == null ? "neutral" : days < 14 ? "danger" : days < 45 ? "warning" : "success";

  const handlePress = useCallback(() => onPress(domain.id), [domain.id, onPress]);

  return (
    <Pressable accessibilityRole="button" onPress={handlePress}>
      <GlassCard>
        <View className="flex-row items-start justify-between gap-3">
          <View className="min-w-0 flex-1 gap-2">
            <Text className="text-lg font-semibold" numberOfLines={1}>
              {domain.domainName}
            </Text>
            <MutedText numberOfLines={1}>Expires {formatDate(domain.expirationDate)}</MutedText>
          </View>
          <Badge tone={domain.verified ? "success" : "warning"}>
            <Text>{domain.verified ? "Verified" : "Verify"}</Text>
          </Badge>
        </View>
        <View className="flex-row flex-wrap gap-2">
          <Badge tone={expiryTone}>
            <Text>{days == null ? "Expiry unknown" : `${days} days`}</Text>
          </Badge>
          {domain.muted ? (
            <Badge>
              <Text>Muted</Text>
            </Badge>
          ) : null}
          {domain.archivedAt ? (
            <Badge>
              <Text>Archived</Text>
            </Badge>
          ) : null}
        </View>
      </GlassCard>
    </Pressable>
  );
}

export const DomainRow = memo(DomainRowImpl);

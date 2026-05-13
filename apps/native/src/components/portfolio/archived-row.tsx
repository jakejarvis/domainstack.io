import { memo, useCallback } from "react";
import { Pressable, View } from "react-native";

import { Button } from "@/components/button";
import { GlassCard } from "@/components/glass-card";
import { MutedText, Text } from "@/components/text";
import { formatRelativeTime } from "@domainstack/utils";

export type ArchivedRowDomain = {
  id: string;
  domainName: string;
  archivedAt: Date | string | null;
};

function ArchivedRowImpl({
  canReactivate,
  domain,
  onPress,
  onReactivate,
  onRemove,
}: {
  canReactivate: boolean;
  domain: ArchivedRowDomain;
  onPress?: (domain: ArchivedRowDomain) => void;
  onReactivate: (domain: ArchivedRowDomain) => void;
  onRemove: (domain: ArchivedRowDomain) => void;
}) {
  const handlePress = useCallback(() => onPress?.(domain), [domain, onPress]);
  const handleReactivate = useCallback(() => onReactivate(domain), [domain, onReactivate]);
  const handleRemove = useCallback(() => onRemove(domain), [domain, onRemove]);

  const archivedRelative = domain.archivedAt ? formatRelativeTime(domain.archivedAt) : null;

  return (
    <Pressable
      accessibilityRole={onPress ? "button" : undefined}
      onPress={onPress ? handlePress : undefined}
    >
      <GlassCard>
        <View className="gap-2">
          <Text className="text-lg font-semibold" numberOfLines={1}>
            {domain.domainName}
          </Text>
          <MutedText numberOfLines={1}>
            {archivedRelative ? `Archived ${archivedRelative}` : "Archived"}
          </MutedText>
        </View>
        <View className="flex-row gap-2">
          <Button
            className="flex-1"
            disabled={!canReactivate}
            onPress={handleReactivate}
            variant="secondary"
          >
            <Text>Reactivate</Text>
          </Button>
          <Button className="flex-1" onPress={handleRemove} variant="danger">
            <Text>Remove</Text>
          </Button>
        </View>
        {!canReactivate ? (
          <MutedText className="text-xs">
            Plan limit reached — upgrade or remove a tracked domain to reactivate.
          </MutedText>
        ) : null}
      </GlassCard>
    </Pressable>
  );
}

export const ArchivedRow = memo(ArchivedRowImpl);

import { Link } from "expo-router";
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
  onReactivate,
  onRemove,
}: {
  canReactivate: boolean;
  domain: ArchivedRowDomain;
  onReactivate: (domain: ArchivedRowDomain) => void;
  onRemove: (domain: ArchivedRowDomain) => void;
}) {
  const handleReactivate = useCallback(() => onReactivate(domain), [domain, onReactivate]);
  const handleRemove = useCallback(() => onRemove(domain), [domain, onRemove]);

  const archivedRelative = domain.archivedAt ? formatRelativeTime(domain.archivedAt) : null;

  return (
    <Link
      asChild
      href={{ params: { domain: domain.domainName }, pathname: "/(tabs)/domains/[domain]" }}
    >
      <Link.Trigger>
        <Pressable accessibilityRole="link">
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
      </Link.Trigger>
      <Link.Preview />
      <Link.Menu>
        <Link.MenuAction
          disabled={!canReactivate}
          icon="arrow.uturn.backward"
          onPress={handleReactivate}
        >
          Reactivate
        </Link.MenuAction>
        <Link.MenuAction destructive icon="trash" onPress={handleRemove}>
          Remove
        </Link.MenuAction>
      </Link.Menu>
    </Link>
  );
}

export const ArchivedRow = memo(ArchivedRowImpl);

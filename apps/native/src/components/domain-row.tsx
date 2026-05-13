import { memo, useCallback } from "react";
import { Pressable, View } from "react-native";

import { useIsSelected, useSelectionMode } from "@/hooks/use-portfolio-selection";
import { cn } from "@/lib/cn";
import { formatDate } from "@/lib/format";
import type { PortfolioDomain } from "@/lib/portfolio";

import { Badge } from "./badge";
import { GlassCard } from "./glass-card";
import { DomainHealthBadge } from "./portfolio/domain-health-badge";
import { RelativeExpiry } from "./relative-expiry";
import { MutedText, Text } from "./text";

function DomainRowImpl({
  domain,
  onLongPress,
  onPress,
}: {
  domain: PortfolioDomain;
  onLongPress?: (domain: PortfolioDomain) => void;
  onPress: (domain: PortfolioDomain) => void;
}) {
  const selectionMode = useSelectionMode();
  const selected = useIsSelected(domain.id);

  const handlePress = useCallback(() => onPress(domain), [domain, onPress]);
  const handleLongPress = useCallback(() => onLongPress?.(domain), [domain, onLongPress]);

  const isSelecting = selectionMode === "selecting";

  return (
    <Pressable
      accessibilityHint={
        isSelecting
          ? "Double tap to toggle selection"
          : onLongPress
            ? "Long press to enter selection mode"
            : undefined
      }
      accessibilityLabel={`${domain.domainName}${
        domain.muted ? ", muted" : ""
      }${domain.verified ? "" : ", needs verification"}`}
      accessibilityRole="button"
      accessibilityState={isSelecting ? { selected } : undefined}
      onLongPress={onLongPress ? handleLongPress : undefined}
      onPress={handlePress}
    >
      <GlassCard>
        <View className="flex-row items-start gap-3">
          {isSelecting ? (
            <View
              accessibilityLabel={selected ? "Selected" : "Not selected"}
              className={cn(
                "mt-1 h-6 w-6 items-center justify-center rounded-full border-2",
                selected ? "border-brand bg-brand" : "border-line",
              )}
            >
              {selected ? (
                <Text className="text-control-primary-text text-xs leading-none font-bold">✓</Text>
              ) : null}
            </View>
          ) : null}
          <View className="min-w-0 flex-1 gap-3">
            <View className="flex-row items-start justify-between gap-3">
              <View className="min-w-0 flex-1 gap-2">
                <Text className="text-lg font-semibold" numberOfLines={1}>
                  {domain.domainName}
                </Text>
                <View className="flex-row flex-wrap items-baseline gap-1">
                  <MutedText numberOfLines={1}>
                    Expires {formatDate(domain.expirationDate)}
                  </MutedText>
                  {domain.expirationDate ? (
                    <RelativeExpiry
                      className="text-text-secondary text-sm"
                      to={domain.expirationDate}
                    />
                  ) : null}
                </View>
              </View>
              <Badge tone={domain.verified ? "success" : "warning"}>
                <Text>{domain.verified ? "Verified" : "Verify"}</Text>
              </Badge>
            </View>
            <View className="flex-row flex-wrap gap-2">
              <DomainHealthBadge
                expirationDate={domain.expirationDate}
                verified={domain.verified}
              />
              {domain.muted ? (
                <Badge>
                  <Text>Muted</Text>
                </Badge>
              ) : null}
            </View>
          </View>
        </View>
      </GlassCard>
    </Pressable>
  );
}

export const DomainRow = memo(DomainRowImpl);

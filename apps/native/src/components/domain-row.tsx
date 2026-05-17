import { Link } from "expo-router";
import { memo, useCallback } from "react";
import { Pressable, View } from "react-native";
import { useCSSVariable } from "uniwind";

import { useIsSelected, useSelectionMode } from "@/hooks/use-portfolio-selection";
import { formatDate } from "@/lib/format";
import type { PortfolioDomain } from "@/lib/portfolio";

import { Badge } from "./badge";
import { GlassCard } from "./glass-card";
import { DomainHealthBadge } from "./portfolio/domain-health-badge";
import { ProviderChips } from "./portfolio/provider-chips";
import { RelativeExpiry } from "./relative-expiry";
import { Symbol } from "./symbol";
import { Text } from "./text";

function DomainRowImpl({
  domain,
  onArchive,
  onLongPress,
  onMute,
  onPress,
}: {
  domain: PortfolioDomain;
  onArchive?: (domain: PortfolioDomain) => void;
  onLongPress?: (domain: PortfolioDomain) => void;
  onMute?: (domain: PortfolioDomain) => void;
  onPress: (domain: PortfolioDomain) => void;
}) {
  const selectionMode = useSelectionMode();
  const selected = useIsSelected(domain.id);
  const isSelecting = selectionMode === "selecting";
  const accent = useCSSVariable("--color-brand") as string;
  const muted = useCSSVariable("--color-muted-foreground") as string;

  const handlePress = useCallback(() => onPress(domain), [domain, onPress]);
  const handleLongPress = useCallback(() => onLongPress?.(domain), [domain, onLongPress]);
  const handleMute = useCallback(() => onMute?.(domain), [domain, onMute]);
  const handleArchive = useCallback(() => onArchive?.(domain), [domain, onArchive]);
  const handleSelect = useCallback(() => onLongPress?.(domain), [domain, onLongPress]);

  const accessibilityLabel = `${domain.domainName}${domain.muted ? ", muted" : ""}${
    domain.verified ? "" : ", needs verification"
  }`;

  const card = (
    <GlassCard>
      <View className="flex-row items-start gap-3">
        {isSelecting ? (
          <View accessibilityLabel={selected ? "Selected" : "Not selected"} className="mt-1">
            <Symbol
              color={selected ? accent : muted}
              name={selected ? "checkmark.circle.fill" : "circle"}
              size={24}
            />
          </View>
        ) : null}
        <View className="min-w-0 flex-1 gap-3">
          <View className="flex-row items-start justify-between gap-3">
            <View className="min-w-0 flex-1 gap-2">
              <Text className="text-lg font-semibold" numberOfLines={1}>
                {domain.domainName}
              </Text>
              <View className="flex-row flex-wrap items-baseline gap-1">
                <Text numberOfLines={1} className="text-sm text-muted-foreground">
                  Expires {formatDate(domain.expirationDate)}
                </Text>
                {domain.expirationDate ? (
                  <RelativeExpiry
                    className="text-sm text-muted-foreground"
                    to={domain.expirationDate}
                  />
                ) : null}
              </View>
            </View>
            <Badge variant={domain.verified ? "success" : "warning"}>
              <Text>{domain.verified ? "Verified" : "Verify"}</Text>
            </Badge>
          </View>
          <View className="flex-row flex-wrap gap-2">
            <DomainHealthBadge expirationDate={domain.expirationDate} verified={domain.verified} />
            {domain.muted ? (
              <Badge>
                <Text>Muted</Text>
              </Badge>
            ) : null}
          </View>
          <ProviderChips domain={domain} />
        </View>
      </View>
    </GlassCard>
  );

  if (isSelecting) {
    return (
      <Pressable
        accessibilityHint="Double tap to toggle selection"
        accessibilityLabel={accessibilityLabel}
        accessibilityRole="button"
        accessibilityState={{ selected }}
        onPress={handlePress}
      >
        {card}
      </Pressable>
    );
  }

  return (
    <Link
      asChild
      href={{ params: { domain: domain.domainName }, pathname: "/(tabs)/domains/[domain]" }}
    >
      <Link.Trigger>
        <Pressable
          accessibilityHint={onLongPress ? "Long press to enter selection mode" : undefined}
          accessibilityLabel={accessibilityLabel}
          accessibilityRole="link"
          onLongPress={onLongPress ? handleLongPress : undefined}
        >
          {card}
        </Pressable>
      </Link.Trigger>
      <Link.Preview />
      <Link.Menu>
        {onMute ? (
          <Link.MenuAction icon={domain.muted ? "bell" : "bell.slash"} onPress={handleMute}>
            {domain.muted ? "Unmute notifications" : "Mute notifications"}
          </Link.MenuAction>
        ) : null}
        {onArchive ? (
          <Link.MenuAction icon="archivebox" onPress={handleArchive}>
            Archive
          </Link.MenuAction>
        ) : null}
        {onLongPress ? (
          <Link.MenuAction icon="checkmark.circle" onPress={handleSelect}>
            Select
          </Link.MenuAction>
        ) : null}
      </Link.Menu>
    </Link>
  );
}

export const DomainRow = memo(DomainRowImpl);

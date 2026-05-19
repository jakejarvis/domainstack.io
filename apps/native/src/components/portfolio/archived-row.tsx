import { Trans, useLingui } from "@lingui/react/macro";
import { Link } from "expo-router";
import { memo, useCallback } from "react";
import { Pressable, View } from "react-native";

import { Button } from "@/components/button";
import { Text } from "@/components/text";
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
  const { t, i18n } = useLingui();
  const handleReactivate = useCallback(() => onReactivate(domain), [domain, onReactivate]);
  const handleRemove = useCallback(() => onRemove(domain), [domain, onRemove]);

  const archivedRelative = domain.archivedAt
    ? formatRelativeTime(domain.archivedAt, i18n.locale)
    : null;

  return (
    <Link
      asChild
      href={{ params: { domain: domain.domainName }, pathname: "/(tabs)/domains/[domain]" }}
    >
      <Link.Trigger>
        <Pressable accessibilityRole="link">
          <View
            className="bg-glass gap-3 overflow-hidden rounded-2xl border border-border p-4"
            style={{ borderCurve: "continuous" }}
          >
            <View className="gap-1">
              <Text className="text-lg font-semibold" numberOfLines={1}>
                {domain.domainName}
              </Text>
              <Text numberOfLines={1} className="text-sm text-muted-foreground">
                {archivedRelative ? t`Archived ${archivedRelative}` : t`Archived`}
              </Text>
            </View>
            <View className="flex-row gap-2">
              <Button
                className="flex-1"
                disabled={!canReactivate}
                onPress={handleReactivate}
                variant="secondary"
              >
                <Text>
                  <Trans>Reactivate</Trans>
                </Text>
              </Button>
              <Button className="flex-1" onPress={handleRemove} variant="danger">
                <Text>
                  <Trans>Remove</Trans>
                </Text>
              </Button>
            </View>
            {!canReactivate ? (
              <Text className="text-xs text-muted-foreground">
                <Trans>Plan limit reached. Upgrade or remove a tracked domain to reactivate.</Trans>
              </Text>
            ) : null}
          </View>
        </Pressable>
      </Link.Trigger>
      <Link.Preview />
      <Link.Menu>
        <Link.MenuAction
          disabled={!canReactivate}
          icon="arrow.uturn.backward"
          onPress={handleReactivate}
        >
          {t`Reactivate`}
        </Link.MenuAction>
        <Link.MenuAction destructive icon="trash" onPress={handleRemove}>
          {t`Remove`}
        </Link.MenuAction>
      </Link.Menu>
    </Link>
  );
}

export const ArchivedRow = memo(ArchivedRowImpl);

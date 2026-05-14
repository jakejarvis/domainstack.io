import { Link, useRouter } from "expo-router";
import { useState } from "react";
import { Alert, Pressable, View } from "react-native";

import { Button } from "@/components/button";
import { EmptyState } from "@/components/empty-state";
import { GlassCard } from "@/components/glass-card";
import { HeaderMenu } from "@/components/header-menu";
import { Screen } from "@/components/screen";
import { MutedText, Text } from "@/components/text";
import { TextField } from "@/components/text-field";
import { analytics } from "@/lib/analytics";
import { useSearchHistoryStore } from "@/lib/stores/search-history-store";
import { isValidDomain, normalizeDomainInput } from "@domainstack/utils/domain/client";

export default function SearchScreen() {
  const router = useRouter();
  const [domain, setDomain] = useState("");
  const history = useSearchHistoryStore((s) => s.history);
  const hasHydrated = useSearchHistoryStore((s) => s.hasHydrated);
  const addDomain = useSearchHistoryStore((s) => s.addDomain);
  const removeDomain = useSearchHistoryStore((s) => s.removeDomain);
  const clearHistory = useSearchHistoryStore((s) => s.clearHistory);

  function openDomain(target: string) {
    addDomain(target);
    router.push({ params: { domain: target }, pathname: "/(tabs)/domains/[domain]" });
  }

  function handleSubmit() {
    const normalized = normalizeDomainInput(domain);
    if (!isValidDomain(normalized)) {
      analytics.track("search_invalid_input", { input: domain });
      Alert.alert("Invalid domain", "Enter a hostname like example.com.");
      return;
    }
    analytics.track("search_submitted", { domain: normalized });
    setDomain("");
    openDomain(normalized);
  }

  function handleClearAll() {
    Alert.alert("Clear recent searches?", "This removes all entries from your history.", [
      { style: "cancel", text: "Cancel" },
      { onPress: clearHistory, style: "destructive", text: "Clear" },
    ]);
  }

  return (
    <Screen>
      <HeaderMenu />

      <MutedText>Look up public registration, DNS, hosting, and certificate data.</MutedText>

      <GlassCard>
        <TextField
          label="Domain"
          onChangeText={setDomain}
          onSubmitEditing={handleSubmit}
          placeholder="example.com"
          returnKeyType="search"
          value={domain}
        />
        <Button disabled={domain.trim().length === 0} onPress={handleSubmit}>
          <Text>Open report</Text>
        </Button>
      </GlassCard>

      {hasHydrated && history.length > 0 && (
        <View className="gap-3">
          <View className="flex-row items-center justify-between">
            <Text className="text-lg font-semibold">Recent</Text>
            <Pressable
              accessibilityLabel="Clear recent searches"
              accessibilityRole="button"
              hitSlop={8}
              onPress={handleClearAll}
            >
              <MutedText className="font-semibold">Clear all</MutedText>
            </Pressable>
          </View>

          <View className="gap-2">
            {history.map((item) => (
              <Link
                asChild
                href={{ params: { domain: item }, pathname: "/(tabs)/domains/[domain]" }}
                key={item}
                onPress={() => addDomain(item)}
              >
                <Link.Trigger>
                  <Pressable
                    accessibilityLabel={`Open report for ${item}`}
                    accessibilityRole="link"
                  >
                    <GlassCard>
                      <View className="flex-row items-center justify-between gap-3">
                        <Text className="flex-1" numberOfLines={1}>
                          {item}
                        </Text>
                        <Pressable
                          accessibilityLabel={`Remove ${item} from recent searches`}
                          accessibilityRole="button"
                          hitSlop={12}
                          onPress={() => removeDomain(item)}
                        >
                          <MutedText className="font-semibold">Remove</MutedText>
                        </Pressable>
                      </View>
                    </GlassCard>
                  </Pressable>
                </Link.Trigger>
                <Link.Preview />
                <Link.Menu>
                  <Link.MenuAction destructive icon="trash" onPress={() => removeDomain(item)}>
                    Remove from recent
                  </Link.MenuAction>
                </Link.Menu>
              </Link>
            ))}
          </View>
        </View>
      )}

      {hasHydrated && history.length === 0 && (
        <EmptyState
          body="Look up a domain to start building your recent list."
          title="No recent searches"
        />
      )}
    </Screen>
  );
}

import { Link, useNavigation, useRouter } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import type { NativeSyntheticEvent } from "react-native";
import { Alert, Pressable } from "react-native";

import { EmptyState } from "@/components/empty-state";
import { GroupedRow, GroupedSection } from "@/components/form/group";
import { HeaderMenu } from "@/components/header-menu";
import { Screen } from "@/components/screen";
import { Text } from "@/components/text";
import { analytics } from "@/lib/analytics";
import { useSearchHistoryStore } from "@/lib/stores/search-history-store";
import { toast } from "@/lib/toast";
import { isValidDomain, normalizeDomainInput } from "@domainstack/utils/domain/client";

export default function SearchScreen() {
  const { push } = useRouter();
  const navigation = useNavigation();
  const [query, setQuery] = useState("");
  const history = useSearchHistoryStore((s) => s.history);
  const hasHydrated = useSearchHistoryStore((s) => s.hasHydrated);
  const addDomain = useSearchHistoryStore((s) => s.addDomain);
  const removeDomain = useSearchHistoryStore((s) => s.removeDomain);
  const clearHistory = useSearchHistoryStore((s) => s.clearHistory);

  function openDomain(target: string) {
    addDomain(target);
    push({ params: { domain: target }, pathname: "/(tabs)/domains/[domain]" });
  }

  function handleSubmit(text: string) {
    const normalized = normalizeDomainInput(text);
    if (!isValidDomain(normalized)) {
      analytics.track("search_invalid_input", { input: text });
      toast.warning({ title: "Invalid domain", message: "Enter a hostname like example.com." });
      return;
    }
    analytics.track("search_submitted", { domain: normalized });
    setQuery("");
    openDomain(normalized);
  }

  useEffect(() => {
    navigation.setOptions({
      headerSearchBarOptions: {
        autoCapitalize: "none",
        hideWhenScrolling: false,
        onChangeText: (event: NativeSyntheticEvent<{ text: string }>) =>
          setQuery(event.nativeEvent.text),
        onSearchButtonPress: (event: NativeSyntheticEvent<{ text: string }>) =>
          handleSubmit(event.nativeEvent.text),
        placeholder: "example.com",
        textContentType: "URL",
      },
    });
  });

  function handleClearAll() {
    Alert.alert("Clear recent searches?", "This removes all entries from your history.", [
      { style: "cancel", text: "Cancel" },
      { onPress: clearHistory, style: "destructive", text: "Clear" },
    ]);
  }

  const filtered = useMemo(() => {
    const trimmed = query.trim().toLowerCase();
    if (trimmed.length === 0) return history;
    return history.filter((item) => item.toLowerCase().includes(trimmed));
  }, [history, query]);

  return (
    <Screen>
      <HeaderMenu />

      {hasHydrated && filtered.length > 0 ? (
        <GroupedSection title={query.trim().length > 0 ? "Matches" : "Recent"}>
          {filtered.map((item) => (
            <Link
              asChild
              href={{ params: { domain: item }, pathname: "/(tabs)/domains/[domain]" }}
              key={item}
              onPress={() => addDomain(item)}
            >
              <Link.Trigger>
                <Pressable accessibilityLabel={`Open report for ${item}`} accessibilityRole="link">
                  <GroupedRow showChevron>
                    <Text numberOfLines={1}>{item}</Text>
                  </GroupedRow>
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
        </GroupedSection>
      ) : null}

      {hasHydrated && history.length > 0 && query.trim().length === 0 ? (
        <GroupedSection>
          <GroupedRow onPress={handleClearAll}>
            <Text className="font-semibold text-destructive">Clear recents</Text>
          </GroupedRow>
        </GroupedSection>
      ) : null}

      {hasHydrated && history.length === 0 ? (
        <EmptyState
          body="Tap the search bar above and enter a hostname to look up its registration, DNS, hosting, and certificate data."
          title="No recent searches"
        />
      ) : null}

      {hasHydrated && history.length > 0 && filtered.length === 0 ? (
        <EmptyState body={`No recent searches match "${query.trim()}".`} title="No matches" />
      ) : null}
    </Screen>
  );
}

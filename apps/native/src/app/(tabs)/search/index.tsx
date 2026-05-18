import { Link, useNavigation, useRouter } from "expo-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import type { NativeSyntheticEvent } from "react-native";
import { Pressable, ScrollView, View } from "react-native";

import { Favicon } from "@/components/domain/favicon";
import { EmptyState } from "@/components/empty-state";
import { GroupedRow, GroupedSection } from "@/components/form/group";
import { HeaderMenu } from "@/components/header-menu";
import { Screen } from "@/components/screen";
import { type ErrorBoundaryProps, ScreenErrorBoundary } from "@/components/screen-error-boundary";
import { SkeletonRows } from "@/components/skeleton";
import { Text } from "@/components/text";
import { analytics } from "@/lib/analytics";
import { confirmDestructive } from "@/lib/native-confirm";
import { useSearchHistoryStore } from "@/lib/stores/search-history-store";
import { toast } from "@/lib/toast";
import { isValidDomain, normalizeDomainInput } from "@domainstack/utils/domain/client";

function truncate(value: string, max: number): string {
  return value.length > max ? `${value.slice(0, max)}…` : value;
}

const SUGGESTIONS = ["vercel.com", "github.com", "cloudflare.com", "stripe.com"];

function SearchHero() {
  return (
    <View className="gap-1 px-1 pt-1">
      <Text className="text-3xl leading-tight font-semibold" style={{ letterSpacing: -0.7 }}>
        Inspect any domain’s{" "}
        <Text className="rounded-lg bg-accent-purple/15 px-1.5 text-3xl font-semibold text-accent-purple">
          registration
        </Text>
        .
      </Text>
      <Text className="text-sm text-muted-foreground">
        WHOIS, DNS, hosting, certs, headers, SEO — one tap.
      </Text>
    </View>
  );
}

function SuggestionChips({ onPick }: { onPick: (domain: string) => void }) {
  return (
    <View className="gap-2">
      <Text variant="footnote" className="ml-1 text-muted-foreground">
        Try
      </Text>
      <ScrollView
        contentContainerStyle={{ gap: 8, paddingRight: 8 }}
        horizontal
        showsHorizontalScrollIndicator={false}
      >
        {SUGGESTIONS.map((domain) => (
          <Pressable
            accessibilityLabel={`Inspect ${domain}`}
            accessibilityRole="button"
            key={domain}
            onPress={() => onPick(domain)}
          >
            <View
              className="flex-row items-center gap-2 rounded-full border border-border bg-secondary px-3 py-2"
              style={{ borderCurve: "continuous" }}
            >
              <Favicon domain={domain} size={16} />
              <Text className="font-mono text-sm">{domain}</Text>
            </View>
          </Pressable>
        ))}
      </ScrollView>
    </View>
  );
}

export default function SearchScreen() {
  const { push } = useRouter();
  const navigation = useNavigation();
  const [query, setQuery] = useState("");
  const history = useSearchHistoryStore((s) => s.history);
  const hasHydrated = useSearchHistoryStore((s) => s.hasHydrated);
  const addDomain = useSearchHistoryStore((s) => s.addDomain);
  const removeDomain = useSearchHistoryStore((s) => s.removeDomain);
  const clearHistory = useSearchHistoryStore((s) => s.clearHistory);

  const openDomain = useCallback(
    (target: string) => {
      addDomain(target);
      push({ params: { domain: target }, pathname: "/(tabs)/domains/[domain]" });
    },
    [addDomain, push],
  );

  const handleSubmit = useCallback(
    (text: string) => {
      const normalized = normalizeDomainInput(text);
      if (!isValidDomain(normalized)) {
        analytics.track("search_invalid_input", { input: text });
        toast.warning({ title: "Invalid domain", message: "Enter a hostname like example.com." });
        return;
      }
      analytics.track("search_submitted", { domain: normalized });
      // Don't reset `query` here: the native search bar text can't be cleared
      // programmatically via headerSearchBarOptions, so zeroing internal state
      // would desync the visible field from the filter. Leaving it keeps them
      // consistent when the user returns to this screen.
      openDomain(normalized);
    },
    [openDomain],
  );

  // Stable handlers → register the native search bar once instead of
  // re-running setOptions every render.
  useEffect(() => {
    navigation.setOptions({
      headerSearchBarOptions: {
        autoCapitalize: "none",
        hideWhenScrolling: true,
        onChangeText: (event: NativeSyntheticEvent<{ text: string }>) =>
          setQuery(event.nativeEvent.text),
        onSearchButtonPress: (event: NativeSyntheticEvent<{ text: string }>) =>
          handleSubmit(event.nativeEvent.text),
        placeholder: "example.com",
        textContentType: "URL",
      },
    });
  }, [navigation, handleSubmit]);

  function handleClearAll() {
    void confirmDestructive({
      confirmLabel: "Clear",
      message: "This removes all entries from your history.",
      title: "Clear recent searches?",
    }).then((confirmed) => {
      if (confirmed) clearHistory();
    });
  }

  const filtered = useMemo(() => {
    const trimmed = query.trim().toLowerCase();
    if (trimmed.length === 0) return history;
    return history.filter((item) => item.toLowerCase().includes(trimmed));
  }, [history, query]);

  return (
    <Screen>
      <HeaderMenu />

      {query.trim().length === 0 ? (
        <>
          <SearchHero />
          <SuggestionChips onPick={openDomain} />
        </>
      ) : null}

      {!hasHydrated ? <SkeletonRows count={3} /> : null}

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
                    <Favicon domain={item} size={28} />
                    <Text className="flex-1 font-mono" numberOfLines={1}>
                      {item}
                    </Text>
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
          icon={{ android: "search", ios: "magnifyingglass" }}
          title="No recent searches"
        />
      ) : null}

      {hasHydrated && history.length > 0 && filtered.length === 0 ? (
        <EmptyState
          body={`No recent searches match “${truncate(query.trim(), 40)}”.`}
          icon={{ android: "search", ios: "magnifyingglass" }}
          title="No matches"
        />
      ) : null}
    </Screen>
  );
}

export function ErrorBoundary(props: ErrorBoundaryProps) {
  return <ScreenErrorBoundary {...props} title="Couldn’t open search" />;
}

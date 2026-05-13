import { useQuery } from "@tanstack/react-query";
import { router } from "expo-router";
import { useMemo, useState } from "react";
import { View } from "react-native";

import { Button } from "@/components/button";
import { DomainRow } from "@/components/domain-row";
import { EmptyState } from "@/components/empty-state";
import { Screen } from "@/components/screen";
import { SegmentedControl } from "@/components/segmented-control";
import { SkeletonRows } from "@/components/skeleton";
import { MutedText, Text } from "@/components/text";
import { TextField } from "@/components/text-field";
import { useTRPC } from "@/lib/api";
import { authClient } from "@/lib/auth";
import {
  type PortfolioDomain,
  type PortfolioSort,
  type PortfolioStatusFilter,
  filterPortfolioDomains,
  sortPortfolioDomains,
} from "@/lib/portfolio";

const filters: Array<{ label: string; value: PortfolioStatusFilter }> = [
  { label: "All", value: "all" },
  { label: "Verified", value: "verified" },
  { label: "Verify", value: "needs-verification" },
  { label: "Muted", value: "muted" },
];

const sorts: Array<{ label: string; value: PortfolioSort }> = [
  { label: "Name", value: "name" },
  { label: "Expiry", value: "expiry" },
  { label: "Recent", value: "created" },
];

export default function DomainsScreen() {
  const session = authClient.useSession();

  if (session.isPending) {
    return (
      <Screen>
        <SkeletonRows count={4} />
      </Screen>
    );
  }

  if (!session.data?.user) {
    return (
      <Screen>
        <View className="gap-2">
          <Text className="text-4xl font-semibold">Portfolio</Text>
          <MutedText>Sign in to track ownership, expiry, providers, and notifications.</MutedText>
        </View>
        <EmptyState
          actionLabel="Sign in"
          body="Search remains available without an account. Your portfolio syncs after sign in."
          onAction={() => router.push("/sign-in")}
          title="Portfolio is locked"
        />
      </Screen>
    );
  }

  return <PortfolioScreen />;
}

function PortfolioScreen() {
  const trpc = useTRPC();
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<PortfolioStatusFilter>("all");
  const [sort, setSort] = useState<PortfolioSort>("name");

  const domainsQuery = useQuery(trpc.tracking.listDomains.queryOptions({ includeArchived: true }));

  const domains = useMemo<PortfolioDomain[]>(() => {
    return (domainsQuery.data ?? []).map((item) => ({
      archivedAt: item.archivedAt,
      createdAt: item.createdAt,
      domainName: item.domainName,
      expirationDate: item.expirationDate,
      id: item.id,
      muted: item.muted,
      verified: item.verified,
    }));
  }, [domainsQuery.data]);

  const visibleDomains = useMemo(
    () => sortPortfolioDomains(filterPortfolioDomains(domains, filter, query), sort),
    [domains, filter, query, sort],
  );

  return (
    <Screen>
      <View className="gap-2">
        <Text className="text-4xl font-semibold">Portfolio</Text>
        <MutedText>Track ownership, expiry, DNS, hosting, mail, and certificate state.</MutedText>
      </View>

      <View className="flex-row gap-3">
        <Button className="flex-1" onPress={() => router.push("/(tabs)/domains/add")}>
          <Text>Add domain</Text>
        </Button>
        <Button className="flex-1" onPress={() => router.push("/settings")} variant="secondary">
          <Text>Settings</Text>
        </Button>
      </View>

      <TextField
        label="Filter domains"
        onChangeText={setQuery}
        placeholder="example.com"
        value={query}
      />
      <SegmentedControl onChange={setFilter} options={filters} value={filter} />
      <SegmentedControl onChange={setSort} options={sorts} value={sort} />

      {domainsQuery.isPending && <SkeletonRows />}

      {domainsQuery.error && (
        <EmptyState
          actionLabel="Retry"
          body={domainsQuery.error.message}
          onAction={() => void domainsQuery.refetch()}
          title="Domains did not load"
        />
      )}

      {!domainsQuery.isPending && !domainsQuery.error && visibleDomains.length === 0 && (
        <EmptyState
          actionLabel="Add domain"
          body="Add a domain to keep its registration, DNS, providers, and notifications close at hand."
          onAction={() => router.push("/(tabs)/domains/add")}
          title="No domains found"
        />
      )}

      <View className="gap-3">
        {visibleDomains.map((domain) => (
          <DomainRow
            domain={domain}
            key={domain.id}
            onPress={() => router.push(`/(tabs)/domains/${domain.id}`)}
          />
        ))}
      </View>
    </Screen>
  );
}

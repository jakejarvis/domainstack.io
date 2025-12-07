"use client";

import { motion } from "motion/react";
import { useMemo, useRef } from "react";
import {
  InfiniteScrollSkeletons,
  InfiniteScrollTrigger,
} from "@/components/dashboard/infinite-scroll-trigger";
import { SelectableDomainCard } from "@/components/dashboard/selectable-domain-card";
import { UpgradeCard } from "@/components/dashboard/upgrade-card";
import type { TrackedDomainWithDetails } from "@/lib/db/repos/tracked-domains";
import type { UserTier } from "@/lib/schemas";

type TrackedDomainsGridProps = {
  domains: TrackedDomainWithDetails[];
  selectedIds?: Set<string>;
  onToggleSelect?: (id: string) => void;
  onVerify: (domain: TrackedDomainWithDetails) => void;
  onRemove: (id: string, domainName: string) => void;
  onArchive?: (id: string, domainName: string) => void;
  tier: UserTier;
  proMaxDomains: number;
  // Infinite scroll props
  hasNextPage?: boolean;
  isFetchingNextPage?: boolean;
  onLoadMore?: () => void;
};

export function TrackedDomainsGrid({
  domains,
  selectedIds = new Set(),
  onToggleSelect,
  onVerify,
  onRemove,
  onArchive,
  tier,
  proMaxDomains,
  hasNextPage = false,
  isFetchingNextPage = false,
  onLoadMore,
}: TrackedDomainsGridProps) {
  const showUpgradeCard = tier === "free";

  // Track seen domain IDs to only animate new items
  const seenIdsRef = useRef<Set<string>>(new Set());

  // Determine which items are new (for animation)
  const domainAnimationStates = useMemo(() => {
    const states = domains.map((domain, index) => {
      const isNew = !seenIdsRef.current.has(domain.id);
      return { domain, isNew, index };
    });

    // Update seen IDs after computing states
    for (const domain of domains) {
      seenIdsRef.current.add(domain.id);
    }

    return states;
  }, [domains]);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
        {domainAnimationStates.map(({ domain, isNew, index }) => (
          <motion.div
            key={domain.id}
            className="h-full"
            initial={isNew ? { opacity: 0, y: 20 } : false}
            animate={{ opacity: 1, y: 0 }}
            transition={
              isNew
                ? { delay: Math.min((index % 20) * 0.05, 0.3), duration: 0.3 }
                : { duration: 0 }
            }
          >
            <SelectableDomainCard
              domain={domain}
              isSelected={selectedIds.has(domain.id)}
              onToggleSelect={() => onToggleSelect?.(domain.id)}
              onVerify={() => onVerify(domain)}
              onRemove={() => onRemove(domain.id, domain.domainName)}
              onArchive={
                onArchive
                  ? () => onArchive(domain.id, domain.domainName)
                  : undefined
              }
            />
          </motion.div>
        ))}

        {/* Show skeleton cards while loading more */}
        {isFetchingNextPage && <InfiniteScrollSkeletons count={3} />}

        {/* Upgrade CTA card for free tier users - show at end when no more pages */}
        {showUpgradeCard && !hasNextPage && (
          <motion.div
            className="h-full"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{
              delay: Math.min(domains.length * 0.05, 0.3),
              duration: 0.3,
            }}
          >
            <UpgradeCard proMaxDomains={proMaxDomains} />
          </motion.div>
        )}
      </div>

      {/* Infinite scroll trigger */}
      {onLoadMore && (
        <InfiniteScrollTrigger
          onLoadMore={onLoadMore}
          hasMore={hasNextPage}
          isLoading={isFetchingNextPage}
        />
      )}
    </div>
  );
}

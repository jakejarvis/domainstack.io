"use client";

import type { Table } from "@tanstack/react-table";
import { FilterX, Globe, Plus, Timer } from "lucide-react";
import Link from "next/link";
import { BulkActionsToolbar } from "@/components/dashboard/bulk-actions-toolbar";
import { TrackedDomainsGrid } from "@/components/dashboard/tracked-domains-grid";
import { TrackedDomainsTable } from "@/components/dashboard/tracked-domains-table";
import { Button } from "@/components/ui/button";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import type { ViewMode } from "@/hooks/use-dashboard-preferences";
import type { SelectionState } from "@/hooks/use-selection";
import type { TrackedDomainWithDetails } from "@/lib/db/repos/tracked-domains";
import type { UserTier } from "@/lib/schemas";

type TrackedDomainsViewProps = {
  viewMode: ViewMode;
  domains: TrackedDomainWithDetails[];
  totalDomains: number; // Total before filtering
  hasActiveFilters: boolean;
  selection: SelectionState;
  tier: UserTier;
  proMaxDomains: number;
  onAddDomain: () => void;
  onVerify: (domain: TrackedDomainWithDetails) => void;
  onRemove: (id: string, domainName: string) => void;
  onArchive?: (id: string, domainName: string) => void;
  onClearFilters?: () => void;
  onBulkArchive: () => void;
  onBulkDelete: () => void;
  isBulkArchiving?: boolean;
  isBulkDeleting?: boolean;
  // Infinite scroll props (grid view only)
  hasNextPage?: boolean;
  isFetchingNextPage?: boolean;
  onLoadMore?: () => void;
  // Table instance callback (table view only)
  onTableReady?: (table: Table<TrackedDomainWithDetails>) => void;
};

export function TrackedDomainsView({
  viewMode,
  domains,
  totalDomains,
  hasActiveFilters,
  selection,
  tier,
  proMaxDomains,
  onAddDomain,
  onVerify,
  onRemove,
  onArchive,
  onClearFilters,
  onBulkArchive,
  onBulkDelete,
  isBulkArchiving = false,
  isBulkDeleting = false,
  hasNextPage = false,
  isFetchingNextPage = false,
  onLoadMore,
  onTableReady,
}: TrackedDomainsViewProps) {
  // Empty state: No domains match filters
  if (domains.length === 0 && hasActiveFilters) {
    return (
      <Empty className="rounded-xl border border-black/15 bg-background/60 backdrop-blur-xl supports-[backdrop-filter]:bg-background/60 dark:border-white/15">
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <FilterX className="size-6" />
          </EmptyMedia>
          <EmptyTitle>No domains match your filters</EmptyTitle>
          <EmptyDescription>
            Try adjusting your search or filter criteria to find what you're
            looking for.
          </EmptyDescription>
        </EmptyHeader>
        <EmptyContent>
          <Button variant="outline" onClick={onClearFilters}>
            Clear Filters
          </Button>
        </EmptyContent>
      </Empty>
    );
  }

  // Empty state: First-time user (no domains at all)
  if (totalDomains === 0) {
    return (
      <Empty className="relative overflow-hidden rounded-xl border border-black/15 bg-background/60 backdrop-blur-xl supports-[backdrop-filter]:bg-background/60 dark:border-white/15">
        {/* Decorative gradient orbs */}
        <div
          aria-hidden
          className="-translate-x-1/2 -translate-y-1/2 pointer-events-none absolute top-0 left-1/4 size-64 rounded-full bg-gradient-to-br from-primary/20 to-transparent blur-3xl"
        />
        <div
          aria-hidden
          className="pointer-events-none absolute right-0 bottom-0 size-48 translate-x-1/4 translate-y-1/4 rounded-full bg-gradient-to-tl from-blue-500/15 to-transparent blur-3xl"
        />

        <EmptyHeader className="relative">
          <EmptyMedia variant="icon">
            <Globe className="size-6" />
          </EmptyMedia>
          <EmptyTitle>Start tracking your domains</EmptyTitle>
          <EmptyDescription className="max-w-md">
            Add your domains to monitor expiration dates, SSL certificates, and
            DNS configurations. We'll notify you before anything expires.
          </EmptyDescription>
        </EmptyHeader>
        <EmptyContent className="relative">
          <Button asChild size="lg">
            <Link
              href="/dashboard/add-domain"
              data-disable-progress={true}
              onClick={(e) => {
                // Allow modifier clicks to open in new tab/window
                if (e.metaKey || e.ctrlKey || e.shiftKey || e.button === 1) {
                  return;
                }
                e.preventDefault();
                onAddDomain();
              }}
            >
              <Plus className="size-4" />
              Add Your First Domain
            </Link>
          </Button>
          <div className="mt-4 flex items-center gap-2 text-muted-foreground text-sm">
            <Timer className="size-4" />
            <span>Verification takes less than 2 minutes</span>
          </div>
        </EmptyContent>
      </Empty>
    );
  }

  return (
    <>
      {viewMode === "table" ? (
        <TrackedDomainsTable
          domains={domains}
          selectedIds={selection.selectedIds}
          onToggleSelect={selection.toggle}
          onVerify={onVerify}
          onRemove={onRemove}
          onArchive={onArchive}
          tier={tier}
          proMaxDomains={proMaxDomains}
          onTableReady={onTableReady}
        />
      ) : (
        <TrackedDomainsGrid
          domains={domains}
          selectedIds={selection.selectedIds}
          onToggleSelect={selection.toggle}
          onVerify={onVerify}
          onRemove={onRemove}
          onArchive={onArchive}
          tier={tier}
          proMaxDomains={proMaxDomains}
          hasNextPage={hasNextPage}
          isFetchingNextPage={isFetchingNextPage}
          onLoadMore={onLoadMore}
        />
      )}

      {/* Bulk actions toolbar - appears when items are selected */}
      <BulkActionsToolbar
        selectedCount={selection.selectedCount}
        totalCount={domains.length}
        isAllSelected={selection.isAllSelected}
        isPartiallySelected={selection.isPartiallySelected}
        onToggleAll={selection.toggleAll}
        onArchive={onBulkArchive}
        onDelete={onBulkDelete}
        onCancel={selection.clearSelection}
        isArchiving={isBulkArchiving}
        isDeleting={isBulkDeleting}
      />
    </>
  );
}

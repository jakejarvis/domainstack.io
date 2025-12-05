"use client";

import { FilterX, Globe, Plus, Sparkles } from "lucide-react";
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
import type { ViewMode } from "@/hooks/use-view-preference";
import type { TrackedDomainWithDetails } from "@/lib/db/repos/tracked-domains";

type TrackedDomainsViewProps = {
  viewMode: ViewMode;
  domains: TrackedDomainWithDetails[];
  totalDomains: number; // Total before filtering
  hasActiveFilters: boolean;
  onAddDomain: () => void;
  onVerify: (domain: TrackedDomainWithDetails) => void;
  onRemove: (id: string, domainName: string) => void;
  onArchive?: (id: string, domainName: string) => void;
  onClearFilters?: () => void;
};

export function TrackedDomainsView({
  viewMode,
  domains,
  totalDomains,
  hasActiveFilters,
  onAddDomain,
  onVerify,
  onRemove,
  onArchive,
  onClearFilters,
}: TrackedDomainsViewProps) {
  // Empty state: No domains match filters
  if (domains.length === 0 && hasActiveFilters) {
    return (
      <Empty className="rounded-3xl border bg-background/60 backdrop-blur-xl supports-[backdrop-filter]:bg-background/60">
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
      <Empty className="relative overflow-hidden rounded-3xl border bg-background/60 backdrop-blur-xl supports-[backdrop-filter]:bg-background/60">
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
          <Button onClick={onAddDomain} size="lg">
            <Plus className="size-4" />
            Add Your First Domain
          </Button>
          <div className="mt-4 flex items-center gap-2 text-muted-foreground text-sm">
            <Sparkles className="size-4" />
            <span>Verification takes less than 2 minutes</span>
          </div>
        </EmptyContent>
      </Empty>
    );
  }

  if (viewMode === "table") {
    return (
      <TrackedDomainsTable
        domains={domains}
        onVerify={onVerify}
        onRemove={onRemove}
        onArchive={onArchive}
      />
    );
  }

  return (
    <TrackedDomainsGrid
      domains={domains}
      onVerify={onVerify}
      onRemove={onRemove}
      onArchive={onArchive}
    />
  );
}

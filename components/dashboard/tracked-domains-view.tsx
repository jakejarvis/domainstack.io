"use client";

import { Globe, Plus } from "lucide-react";
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
  onAddDomain: () => void;
  onVerify: (domain: TrackedDomainWithDetails) => void;
  onRemove: (id: string) => void;
};

export function TrackedDomainsView({
  viewMode,
  domains,
  onAddDomain,
  onVerify,
  onRemove,
}: TrackedDomainsViewProps) {
  // Show empty state for both views
  if (domains.length === 0) {
    return (
      <Empty className="rounded-3xl border bg-background/60 backdrop-blur-xl supports-[backdrop-filter]:bg-background/60">
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <Globe className="size-6" />
          </EmptyMedia>
          <EmptyTitle>No domains tracked yet</EmptyTitle>
          <EmptyDescription>
            Add your first domain to start monitoring expiration dates and
            receive timely notifications.
          </EmptyDescription>
        </EmptyHeader>
        <EmptyContent>
          <Button onClick={onAddDomain}>
            <Plus className="size-4" />
            Add Your First Domain
          </Button>
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
      />
    );
  }

  return (
    <TrackedDomainsGrid
      domains={domains}
      onAddDomain={onAddDomain}
      onVerify={onVerify}
      onRemove={onRemove}
    />
  );
}

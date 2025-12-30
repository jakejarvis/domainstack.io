"use client";

import { formatDistanceToNow } from "date-fns";
import { Archive, CircleFadingArrowUp, RotateCcw, Trash2 } from "lucide-react";
import { DashboardBanner } from "@/components/dashboard/dashboard-banner";
import { Favicon } from "@/components/icons/favicon";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import type { TrackedDomainWithDetails } from "@/lib/db/repos/tracked-domains";
import type { UserTier } from "@/lib/schemas";

type ArchivedDomainsViewProps = {
  domains: TrackedDomainWithDetails[];
  onUnarchive: (id: string) => void;
  onRemove: (id: string, domainName: string) => void;
  canUnarchive: boolean;
  tier: UserTier;
};

export function ArchivedDomainsView({
  domains,
  onUnarchive,
  onRemove,
  canUnarchive,
  tier,
}: ArchivedDomainsViewProps) {
  if (domains.length === 0) {
    return (
      <Empty className="rounded-xl border bg-background/60 backdrop-blur-xl supports-[backdrop-filter]:bg-background/60">
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <Archive className="size-6" />
          </EmptyMedia>
          <EmptyTitle>No archived domains</EmptyTitle>
          <EmptyDescription>
            Archived domains will appear here. You can archive domains you want
            to keep but don't need to actively monitor.
          </EmptyDescription>
        </EmptyHeader>
      </Empty>
    );
  }

  const isPro = tier === "pro";

  return (
    <div className="space-y-4">
      {/* Info banner when at limit */}
      {!canUnarchive && !isPro && (
        <DashboardBanner
          variant="warning"
          icon={CircleFadingArrowUp}
          title="Upgrade to Reactivate"
          description="You've reached your domain tracking limit. Upgrade to Pro or remove active domains to reactivate archived ones."
        />
      )}

      {/* Archived domains list */}
      <div className="grid gap-3">
        {domains.map((domain) => (
          <Card key={domain.id} className="opacity-75">
            <CardContent className="flex items-center justify-between p-4">
              <div className="flex min-w-0 flex-1 items-center gap-3">
                <Favicon domain={domain.domainName} size={24} />
                <div className="min-w-0 flex-1">
                  <div className="truncate font-medium">
                    {domain.domainName}
                  </div>
                  <div className="text-muted-foreground text-sm">
                    Archived{" "}
                    {domain.archivedAt
                      ? formatDistanceToNow(new Date(domain.archivedAt), {
                          addSuffix: true,
                          includeSeconds: false,
                        })
                      : "recently"}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Tooltip>
                  <TooltipTrigger
                    render={
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => onUnarchive(domain.id)}
                        disabled={!canUnarchive}
                      >
                        <RotateCcw />
                        <span className="sr-only sm:not-sr-only sm:ml-2">
                          Reactivate
                        </span>
                      </Button>
                    }
                  />
                  <TooltipContent>
                    {canUnarchive
                      ? "Reactivate this domain"
                      : "Upgrade or remove active domains first"}
                  </TooltipContent>
                </Tooltip>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => onRemove(domain.id, domain.domainName)}
                >
                  <Trash2 className="text-danger-foreground" />
                  <span className="sr-only">Delete</span>
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

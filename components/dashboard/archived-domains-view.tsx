"use client";

import { formatDistanceToNow } from "date-fns";
import { Archive, Crown, RotateCcw, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
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

type ArchivedDomainsViewProps = {
  domains: TrackedDomainWithDetails[];
  onUnarchive: (id: string) => void;
  onRemove: (id: string) => void;
  canUnarchive: boolean;
  tier: string;
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
      <Empty className="rounded-3xl border bg-background/60 backdrop-blur-xl supports-[backdrop-filter]:bg-background/60">
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
        <Card className="border-amber-500/20 bg-amber-500/5">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <Crown className="size-4 text-amber-500" />
              Upgrade to Reactivate
            </CardTitle>
          </CardHeader>
          <CardContent>
            <CardDescription>
              You've reached your domain tracking limit. Upgrade to Pro or
              remove active domains to reactivate archived ones.
            </CardDescription>
          </CardContent>
        </Card>
      )}

      {/* Archived domains list */}
      <div className="grid gap-3">
        {domains.map((domain) => (
          <Card key={domain.id} className="opacity-75">
            <CardContent className="flex items-center justify-between p-4">
              <div className="min-w-0 flex-1">
                <div className="font-medium">{domain.domainName}</div>
                <div className="text-muted-foreground text-sm">
                  Archived{" "}
                  {domain.archivedAt
                    ? formatDistanceToNow(new Date(domain.archivedAt), {
                        addSuffix: true,
                      })
                    : "recently"}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => onUnarchive(domain.id)}
                      disabled={!canUnarchive}
                    >
                      <RotateCcw className="size-4" />
                      <span className="sr-only sm:not-sr-only sm:ml-2">
                        Reactivate
                      </span>
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    {canUnarchive
                      ? "Reactivate this domain"
                      : "Upgrade or remove active domains first"}
                  </TooltipContent>
                </Tooltip>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => onRemove(domain.id)}
                      className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                    >
                      <Trash2 className="size-4" />
                      <span className="sr-only">Delete</span>
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Permanently delete</TooltipContent>
                </Tooltip>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

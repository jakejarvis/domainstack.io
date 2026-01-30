import type { TrackedDomainWithDetails } from "@domainstack/types";
import { Button } from "@domainstack/ui/button";
import { Card, CardContent } from "@domainstack/ui/card";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@domainstack/ui/empty";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@domainstack/ui/tooltip";
import { cn } from "@domainstack/ui/utils";
import {
  IconArchive,
  IconCircleArrowUp,
  IconRefresh,
  IconTrash,
} from "@tabler/icons-react";
import { formatDistanceToNow } from "date-fns";
import { DashboardBannerDismissable } from "@/components/dashboard/dashboard-banner-dismissable";
import { Favicon } from "@/components/icons/favicon";
import { useDashboardActions } from "@/context/dashboard-context";
import { useSubscription } from "@/hooks/use-subscription";

type ArchivedDomainsListProps = {
  domains: TrackedDomainWithDetails[];
};

export function ArchivedDomainsList({ domains }: ArchivedDomainsListProps) {
  const { onUnarchive, onRemove } = useDashboardActions();
  const { subscription, isPro } = useSubscription();

  if (domains.length === 0) {
    return (
      <Empty className="rounded-xl border bg-background/60">
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <IconArchive className="size-6" />
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

  return (
    <div className="space-y-4">
      {/* Info banner when at limit */}
      {!subscription?.canAddMore && !isPro && (
        <DashboardBannerDismissable
          variant="warning"
          icon={IconCircleArrowUp}
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
                <Favicon domain={domain.domainName} className="size-6" />
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
                      <div
                        className={cn(
                          "pointer-events-auto",
                          !subscription?.canAddMore && "cursor-not-allowed",
                        )}
                      >
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => onUnarchive(domain.id)}
                          disabled={!subscription?.canAddMore}
                        >
                          <IconRefresh />
                          <span className="sr-only sm:not-sr-only sm:ml-2">
                            Reactivate
                          </span>
                        </Button>
                      </div>
                    }
                  />
                  <TooltipContent>
                    {subscription?.canAddMore
                      ? "Reactivate this domain"
                      : "Upgrade or remove active domains first"}
                  </TooltipContent>
                </Tooltip>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => onRemove(domain.id, domain.domainName)}
                >
                  <IconTrash className="text-danger-foreground" />
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

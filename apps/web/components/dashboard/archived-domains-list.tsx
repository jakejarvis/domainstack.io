import { IconArchive, IconCircleArrowUp, IconRefresh, IconTrash } from "@tabler/icons-react";

import { DashboardBannerDismissable } from "@/components/dashboard/dashboard-banner-dismissable";
import { Favicon } from "@/components/icons/favicon";
import { useDashboardActions } from "@/context/dashboard-context";
import { useHydratedNow } from "@/hooks/use-hydrated-now";
import { useSubscription } from "@/hooks/use-subscription";
import type { TrackedDomainWithDetails } from "@domainstack/types";
import { Button } from "@domainstack/ui/button";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@domainstack/ui/empty";
import {
  Item,
  ItemActions,
  ItemContent,
  ItemDescription,
  ItemGroup,
  ItemMedia,
  ItemTitle,
} from "@domainstack/ui/item";
import { Tooltip, TooltipContent, TooltipTrigger } from "@domainstack/ui/tooltip";
import { cn } from "@domainstack/ui/utils";
import { formatRelativeTime, toDateTimeAttr } from "@domainstack/utils/date";

type ArchivedDomainsListProps = {
  domains: TrackedDomainWithDetails[];
};

export function ArchivedDomainsList({ domains }: ArchivedDomainsListProps) {
  const { onUnarchive, onRemove } = useDashboardActions();
  const { subscription, isPro } = useSubscription();

  if (domains.length === 0) {
    return (
      <Empty className="rounded-xl border bg-background">
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <IconArchive className="size-6" />
          </EmptyMedia>
          <EmptyTitle>No archived domains</EmptyTitle>
          <EmptyDescription>
            Archived domains will appear here. You can archive domains you want to keep but don't
            need to actively monitor.
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
      <ItemGroup className="gap-3">
        {domains.map((domain) => (
          <Item key={domain.id} variant="outline" role="listitem" className="opacity-75">
            <ItemMedia>
              <Favicon domain={domain.domainName} className="size-6" />
            </ItemMedia>
            <ItemContent className="min-w-0">
              <ItemTitle className="block w-full truncate">{domain.domainName}</ItemTitle>
              <ItemDescription>
                Archived <ArchivedRelativeTime archivedAt={domain.archivedAt} />
              </ItemDescription>
            </ItemContent>
            <ItemActions>
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
                        className={!subscription?.canAddMore ? "pointer-events-none" : undefined}
                      >
                        <IconRefresh />
                        <span className="sr-only sm:not-sr-only sm:ml-2">Reactivate</span>
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
              <Button variant="ghost" size="sm" onClick={() => onRemove(domain.id)}>
                <IconTrash className="text-danger-foreground" />
                <span className="sr-only">Delete</span>
              </Button>
            </ItemActions>
          </Item>
        ))}
      </ItemGroup>
    </div>
  );
}

function ArchivedRelativeTime({ archivedAt }: { archivedAt: Date | string | null | undefined }) {
  const now = useHydratedNow();
  const dateTime = archivedAt ? toDateTimeAttr(archivedAt) : undefined;

  // Unknown timestamp — not a loading state.
  if (!dateTime) {
    return <span>recently</span>;
  }

  const label = now ? formatRelativeTime(new Date(dateTime), now) : null;

  return (
    <time
      dateTime={dateTime}
      className={!label ? "invisible" : undefined}
      aria-hidden={!label || undefined}
      suppressHydrationWarning
    >
      {label}
    </time>
  );
}

import { IconAlertTriangle, IconRefresh } from "@tabler/icons-react";

import { Button } from "@domainstack/ui/button";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@domainstack/ui/empty";
import { Icon } from "@domainstack/ui/icon";

type DashboardErrorProps = {
  onRetry: () => void;
};

export function DashboardError({ onRetry }: DashboardErrorProps) {
  return (
    <Empty className="min-h-[400px] rounded-xl border bg-background shadow-sm">
      <EmptyHeader>
        <EmptyMedia>
          <Icon variant="destructive">
            <IconAlertTriangle />
          </Icon>
        </EmptyMedia>
        <EmptyTitle>Unable to load dashboard</EmptyTitle>
        <EmptyDescription>
          We couldn't load your dashboard data. This might be a temporary issue. Please try again.
        </EmptyDescription>
      </EmptyHeader>
      <EmptyContent>
        <Button onClick={onRetry} variant="outline">
          <IconRefresh />
          Retry
        </Button>
      </EmptyContent>
    </Empty>
  );
}

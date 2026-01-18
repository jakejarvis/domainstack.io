import { ArrowClockwiseIcon, WarningIcon } from "@phosphor-icons/react/ssr";
import { Button } from "@/components/ui/button";
import { IconBadge } from "@/components/ui/icon-badge";

type DashboardErrorProps = {
  onRetry: () => void;
};

export function DashboardError({ onRetry }: DashboardErrorProps) {
  return (
    <div className="flex min-h-[400px] flex-col items-center justify-center space-y-4 rounded-xl border border-destructive/20 bg-destructive/5 p-8 text-center">
      <IconBadge size="lg" color="destructive">
        <WarningIcon className="size-6" />
      </IconBadge>
      <div className="space-y-2">
        <h2 className="font-semibold text-lg">Unable to load dashboard</h2>
        <p className="max-w-md text-muted-foreground text-sm">
          We couldn't load your dashboard data. This might be a temporary issue.
          Please try again.
        </p>
      </div>
      <Button onClick={onRetry} variant="outline" className="gap-2">
        <ArrowClockwiseIcon />
        Retry
      </Button>
    </div>
  );
}

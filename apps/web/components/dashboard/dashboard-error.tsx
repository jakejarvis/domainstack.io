import { IconAlertTriangle, IconRefresh } from "@tabler/icons-react";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";

type DashboardErrorProps = {
  onRetry: () => void;
};

export function DashboardError({ onRetry }: DashboardErrorProps) {
  return (
    <div className="flex min-h-[400px] flex-col items-center justify-center space-y-4 rounded-xl border border-destructive/20 bg-destructive/5 p-8 text-center">
      <Icon size="lg" variant="destructive">
        <IconAlertTriangle />
      </Icon>
      <div className="space-y-2">
        <h2 className="font-semibold text-lg">Unable to load dashboard</h2>
        <p className="max-w-md text-muted-foreground text-sm">
          We couldn't load your dashboard data. This might be a temporary issue.
          Please try again.
        </p>
      </div>
      <Button onClick={onRetry} variant="outline" className="gap-2">
        <IconRefresh />
        Retry
      </Button>
    </div>
  );
}

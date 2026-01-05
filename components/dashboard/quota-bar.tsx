import { Meter } from "@/components/ui/meter";
import { cn } from "@/lib/utils";

interface QuotaBarProps
  extends Omit<React.ComponentProps<typeof Meter>, "value"> {
  activeCount?: number;
  planQuota?: number;
}

export function QuotaBar({
  activeCount,
  planQuota,
  className,
  ...props
}: QuotaBarProps) {
  if (!activeCount || !planQuota) {
    return null;
  }

  const percentage =
    planQuota > 0 ? Math.min((activeCount / planQuota) * 100, 100) : 0;
  const isAtLimit = activeCount >= planQuota;
  const isNearLimit = !isAtLimit && activeCount >= planQuota * 0.8;

  return (
    <Meter
      value={percentage}
      className={cn(
        // Base styles
        "bg-primary/12 dark:bg-primary/20",
        // Color variants
        isAtLimit && "[&_[data-slot=meter-indicator]]:bg-accent-red",
        isNearLimit && "[&_[data-slot=meter-indicator]]:bg-accent-orange",
        className,
      )}
      {...props}
    />
  );
}

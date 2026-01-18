import { Meter } from "@/components/ui/meter";
import { cn } from "@/lib/utils";

interface QuotaBarProps
  extends Omit<React.ComponentProps<typeof Meter>, "value"> {
  used: number;
  planQuota: number;
}

export function QuotaBar({
  used,
  planQuota,
  className,
  ...props
}: QuotaBarProps) {
  const percentage =
    planQuota > 0 ? Math.min((used / planQuota) * 100, 100) : 0;
  const isAtLimit = used >= planQuota;
  const isNearLimit = !isAtLimit && used >= planQuota * 0.8;

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
      aria-label="Domain usage"
      aria-valuetext={`${used} of ${planQuota} domains used`}
      {...props}
    />
  );
}

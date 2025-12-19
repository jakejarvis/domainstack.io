"use client";

import { Meter } from "@/components/ui/meter";
import { cn } from "@/lib/utils";

interface UsageMeterProps
  extends Omit<React.ComponentProps<typeof Meter>, "value"> {
  activeCount: number;
  maxDomains: number;
}

export function UsageMeter({
  activeCount,
  maxDomains,
  className,
  ...props
}: UsageMeterProps) {
  const percentage =
    maxDomains > 0 ? Math.min((activeCount / maxDomains) * 100, 100) : 0;
  const isAtLimit = activeCount >= maxDomains;
  const isNearLimit = !isAtLimit && activeCount >= maxDomains * 0.8;

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

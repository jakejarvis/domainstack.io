import { IconHourglassEmpty } from "@tabler/icons-react";
import { ms } from "ms";

import { Badge } from "@domainstack/ui/badge";
import {
  ResponsiveTooltip,
  ResponsiveTooltipContent,
  ResponsiveTooltipTrigger,
} from "@domainstack/ui/responsive-tooltip";

export function TtlBadge({ ttl }: { ttl: number }) {
  return (
    <ResponsiveTooltip>
      <ResponsiveTooltipTrigger
        nativeButton={false}
        render={
          <Badge
            variant="outline"
            className="cursor-default py-1 text-[11px] leading-none text-muted-foreground"
          >
            <IconHourglassEmpty />
            <span suppressHydrationWarning>{ms(ttl * 1000)}</span>
          </Badge>
        }
      />
      <ResponsiveTooltipContent>
        <span className="font-mono text-xs">{ttl}</span>
      </ResponsiveTooltipContent>
    </ResponsiveTooltip>
  );
}

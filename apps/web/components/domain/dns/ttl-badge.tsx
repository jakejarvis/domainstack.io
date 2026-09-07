import { IconHourglassEmpty } from "@tabler/icons-react";
import { ms } from "ms";

import { Badge } from "@domainstack/ui/badge";
import {
  ResponsiveTooltip,
  ResponsiveTooltipContent,
  ResponsiveTooltipTrigger,
} from "@domainstack/ui/responsive-tooltip";
import { toDurationAttr } from "@domainstack/utils/date";

export function TtlBadge({ ttl }: { ttl: number }) {
  const duration = toDurationAttr(ttl);

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
            {duration ? (
              <time dateTime={duration} suppressHydrationWarning>
                {ms(ttl * 1000)}
              </time>
            ) : (
              <span>-</span>
            )}
          </Badge>
        }
      />
      <ResponsiveTooltipContent>
        <span className="font-mono text-xs">{ttl}</span>
      </ResponsiveTooltipContent>
    </ResponsiveTooltip>
  );
}

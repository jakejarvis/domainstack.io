import { ClockCountdownIcon } from "@phosphor-icons/react/ssr";
import { ms } from "ms";
import { Badge } from "@/components/ui/badge";
import {
  ResponsiveTooltip,
  ResponsiveTooltipContent,
  ResponsiveTooltipTrigger,
} from "@/components/ui/responsive-tooltip";

export function TtlBadge({ ttl }: { ttl: number }) {
  return (
    <ResponsiveTooltip>
      <ResponsiveTooltipTrigger
        nativeButton={false}
        render={
          <Badge
            variant="outline"
            className="cursor-default py-1 text-[11px] text-muted-foreground leading-none"
          >
            <ClockCountdownIcon />
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

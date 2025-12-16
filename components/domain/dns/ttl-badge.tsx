"use client";

import { ClockFading } from "lucide-react";
import { ms } from "ms";
import { Badge } from "@/components/ui/badge";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

export function TtlBadge({ ttl }: { ttl: number }) {
  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <Badge
            variant="outline"
            className="cursor-default py-1 text-[11px] text-muted-foreground"
          >
            <ClockFading />
            <span className="leading-none" suppressHydrationWarning>
              {ms(ttl * 1000)}
            </span>
          </Badge>
        }
      />
      <TooltipContent>
        <span className="font-mono text-xs">{ttl}</span>
      </TooltipContent>
    </Tooltip>
  );
}

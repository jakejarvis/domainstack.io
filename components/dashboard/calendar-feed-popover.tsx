"use client";

import { CalendarFold, CalendarSync, XIcon } from "lucide-react";
import { useState } from "react";
import { CalendarInstructions } from "@/components/calendar-instructions";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverDescription,
  PopoverHeader,
  PopoverTitle,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Separator } from "@/components/ui/separator";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

export function CalendarFeedPopover() {
  const [open, setOpen] = useState(false);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <Tooltip>
        <TooltipTrigger
          render={
            <PopoverTrigger
              render={
                <Button variant="outline" size="icon">
                  <CalendarSync className="-translate-y-[1px]" />
                  <span className="sr-only">Subscribe</span>
                </Button>
              }
            />
          }
        />
        <TooltipContent>Subscribe to updates</TooltipContent>
      </Tooltip>
      <PopoverContent
        className="max-sm:!left-0 max-sm:!right-0 max-sm:!mx-auto max-sm:!translate-x-0 overflow-hidden bg-popover/95 p-0 backdrop-blur-lg max-sm:w-[calc(100vw-1rem)] sm:w-[420px]"
        align="end"
        side="bottom"
        collisionAvoidance={{
          side: "none",
          align: "shift",
        }}
        collisionPadding={8}
      >
        <div className="flex flex-col">
          <PopoverHeader className="p-4">
            <PopoverTitle className="flex items-center gap-2">
              <CalendarFold className="size-4" />
              Calendar Feed
            </PopoverTitle>
            <PopoverDescription>
              Subscribe to domain expiration dates in your favorite calendar
              app.
            </PopoverDescription>

            <Button
              variant="ghost"
              className="absolute top-2 right-2 z-10 size-6 text-muted-foreground hover:text-foreground"
              onClick={() => setOpen(false)}
              aria-label="Close"
            >
              <XIcon />
              <span className="sr-only">Close</span>
            </Button>
          </PopoverHeader>

          <Separator className="bg-muted" />

          <CalendarInstructions className="bg-background/25 p-4" />
        </div>
      </PopoverContent>
    </Popover>
  );
}

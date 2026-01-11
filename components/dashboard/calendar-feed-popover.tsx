"use client";

import { CalendarIcon, RssSimpleIcon, XIcon } from "@phosphor-icons/react/ssr";
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
                <Button variant="outline">
                  <RssSimpleIcon />
                  <span className="sr-only">Subscribe</span>
                </Button>
              }
            />
          }
        />
        <TooltipContent>Subscribe to updates</TooltipContent>
      </Tooltip>
      <PopoverContent
        className="max-sm:!left-0 max-sm:!right-0 max-sm:!mx-auto max-sm:!translate-x-0 overflow-hidden bg-popover/95 p-0 backdrop-blur-lg max-sm:w-[calc(100vw-1rem)] sm:w-[400px]"
        align="end"
        side="bottom"
        collisionAvoidance={{
          side: "none",
          align: "shift",
        }}
        collisionPadding={8}
      >
        <div className="flex flex-col">
          <PopoverHeader className="px-4 pt-5 pb-3">
            <PopoverTitle className="flex items-center gap-2">
              <CalendarIcon className="size-4" />
              Calendar Feed
            </PopoverTitle>
            <PopoverDescription className="mt-0.5">
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

          <CalendarInstructions className="bg-background/50 p-4" />
        </div>
      </PopoverContent>
    </Popover>
  );
}

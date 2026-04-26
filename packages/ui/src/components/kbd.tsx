import { mergeProps } from "@base-ui/react/merge-props";
import { useRender } from "@base-ui/react/use-render";

import { cn } from "../utils";

function Kbd({ className, render, ...props }: useRender.ComponentProps<"kbd">) {
  return useRender({
    defaultTagName: "kbd",
    render,
    props: mergeProps<"kbd">(props, {
      className: cn(
        "pointer-events-none inline-flex h-5 w-fit min-w-5 items-center justify-center gap-1 rounded-sm bg-muted px-1 font-sans text-xs font-medium text-muted-foreground select-none [&_svg:not([class*='size-'])]:size-3 [[data-slot=tooltip-content]_&]:bg-background/20 [[data-slot=tooltip-content]_&]:text-background dark:[[data-slot=tooltip-content]_&]:bg-background/10",
        className,
      ),
    }),
    state: {
      slot: "kbd",
    },
  });
}

function KbdGroup({ className, render, ...props }: useRender.ComponentProps<"div">) {
  return useRender({
    defaultTagName: "div",
    render,
    props: mergeProps<"div">(props, {
      className: cn("inline-flex items-center gap-1", className),
    }),
    state: {
      slot: "kbd-group",
    },
  });
}

export { Kbd, KbdGroup };

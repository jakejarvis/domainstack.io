import { mergeProps } from "@base-ui/react/merge-props";
import { useRender } from "@base-ui/react/use-render";

function Kbd({ render, ...props }: useRender.ComponentProps<"kbd">) {
  return useRender({
    defaultTagName: "kbd",
    render,
    props: mergeProps<"kbd">(props, {
      className:
        "pointer-events-none inline-flex h-5 w-fit min-w-5 select-none items-center justify-center gap-1 rounded-sm bg-muted px-1 font-medium font-sans text-muted-foreground text-xs [&_svg:not([class*='size-'])]:size-3 [[data-slot=tooltip-content]_&]:bg-background/20 [[data-slot=tooltip-content]_&]:text-background dark:[[data-slot=tooltip-content]_&]:bg-background/10",
    }),
    state: {
      slot: "kbd",
    },
  });
}

function KbdGroup({ render, ...props }: useRender.ComponentProps<"div">) {
  return useRender({
    defaultTagName: "div",
    render,
    props: mergeProps<"div">(props, {
      className: "inline-flex items-center gap-1",
    }),
    state: {
      slot: "kbd-group",
    },
  });
}

export { Kbd, KbdGroup };

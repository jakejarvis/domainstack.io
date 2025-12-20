"use client";

import { Popover as PopoverPrimitive } from "@base-ui/react/popover";
import { Tooltip as TooltipPrimitive } from "@base-ui/react/tooltip";
import { createContext, useContext } from "react";
import { usePointerCapability } from "@/hooks/use-pointer-capability";
import { cn } from "@/lib/utils";

const ResponsiveTooltipContext = createContext<{
  isTouchDevice: boolean;
} | null>(null);

function ResponsiveTooltip({
  ...props
}: PopoverPrimitive.Root.Props & TooltipPrimitive.Root.Props) {
  const { isTouchDevice } = usePointerCapability();

  const { Root } = isTouchDevice ? PopoverPrimitive : TooltipPrimitive;

  return (
    <ResponsiveTooltipContext.Provider value={{ isTouchDevice }}>
      {isTouchDevice ? (
        <Root data-slot="responsive-tooltip" {...props} />
      ) : (
        <TooltipPrimitive.Provider
          delay={0}
          data-slot="responsive-tooltip-provider"
        >
          <Root data-slot="responsive-tooltip" {...props} />
        </TooltipPrimitive.Provider>
      )}
    </ResponsiveTooltipContext.Provider>
  );
}

function ResponsiveTooltipTrigger({
  nativeButton,
  ...props
}: Omit<
  TooltipPrimitive.Trigger.Props<unknown> &
    PopoverPrimitive.Trigger.Props<unknown>,
  "handle"
> &
  Pick<PopoverPrimitive.Trigger.Props<unknown>, "nativeButton">) {
  const ctx = useContext(ResponsiveTooltipContext);
  if (!ctx) {
    throw new Error(
      "ResponsiveTooltipTrigger must be used within <ResponsiveTooltip>.",
    );
  }

  const { Trigger } = ctx.isTouchDevice ? PopoverPrimitive : TooltipPrimitive;
  const triggerProps = ctx.isTouchDevice ? { nativeButton } : {};

  return (
    <Trigger
      data-slot="responsive-tooltip-trigger"
      {...props}
      {...triggerProps}
    />
  );
}

function ResponsiveTooltipContent({
  className,
  side = "top",
  sideOffset = 4,
  align = "center",
  alignOffset = 0,
  children,
  ...props
}: TooltipPrimitive.Popup.Props &
  PopoverPrimitive.Popup.Props &
  Pick<
    TooltipPrimitive.Positioner.Props,
    "align" | "alignOffset" | "side" | "sideOffset"
  >) {
  const ctx = useContext(ResponsiveTooltipContext);
  if (!ctx) {
    throw new Error(
      "ResponsiveTooltipContent must be used within <ResponsiveTooltip>.",
    );
  }

  const { Portal, Positioner, Popup, Arrow } = ctx.isTouchDevice
    ? PopoverPrimitive
    : TooltipPrimitive;

  return (
    <Portal>
      <Positioner
        sideOffset={sideOffset}
        align={align}
        alignOffset={alignOffset}
        side={side}
        className="isolate z-50"
      >
        <Popup
          data-slot="responsive-tooltip-content"
          className={cn(
            "relative z-50 w-fit max-w-xs overflow-visible rounded-md bg-foreground px-3 py-1.5 text-background text-xs selection:bg-background selection:text-foreground",
            "origin-[var(--transform-origin)] transition-[transform,opacity] duration-200",
            "data-[ending-style]:opacity-0 data-[starting-style]:opacity-0",
            "data-[ending-style]:scale-95 data-[starting-style]:scale-95",
            className,
          )}
          {...props}
        >
          <Arrow className="size-2.5 translate-y-[calc(-50%_-_2px)] rotate-45 rounded-[2px] bg-foreground fill-foreground data-[side=bottom]:top-1 data-[side=left]:top-1/2! data-[side=right]:top-1/2! data-[side=left]:-right-1 data-[side=top]:-bottom-2.5 data-[side=right]:-left-1 data-[side=left]:-translate-y-1/2 data-[side=right]:-translate-y-1/2" />
          <div className="relative z-10">{children}</div>
        </Popup>
      </Positioner>
    </Portal>
  );
}

export {
  ResponsiveTooltip,
  ResponsiveTooltipTrigger,
  ResponsiveTooltipContent,
};

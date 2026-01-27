"use client";

import { Popover as PopoverPrimitive } from "@base-ui/react/popover";
import { Tooltip as TooltipPrimitive } from "@base-ui/react/tooltip";
import { createContext, useContext, useMemo } from "react";
import { usePointerCapability } from "../hooks/use-pointer-capability";
import { cn } from "../utils";

const ResponsiveTooltipContext = createContext<{
  isTouchDevice: boolean;
} | null>(null);

function ResponsiveTooltip({
  ...props
}: PopoverPrimitive.Root.Props & TooltipPrimitive.Root.Props) {
  const { isTouchDevice } = usePointerCapability();

  const contextValue = useMemo(() => ({ isTouchDevice }), [isTouchDevice]);

  return (
    <ResponsiveTooltipContext.Provider value={contextValue}>
      {isTouchDevice ? (
        <PopoverPrimitive.Root data-slot="responsive-tooltip" {...props} />
      ) : (
        <TooltipPrimitive.Provider delay={0}>
          <TooltipPrimitive.Root data-slot="responsive-tooltip" {...props} />
        </TooltipPrimitive.Provider>
      )}
    </ResponsiveTooltipContext.Provider>
  );
}

function ResponsiveTooltipTrigger({
  nativeButton,
  closeDelay,
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

  // For tooltips (non-touch), add a small closeDelay by default to prevent
  // premature closing when content changes size (e.g., during lazy loading).
  // This gives the positioner time to recalculate without losing hover state.
  const tooltipCloseDelay = closeDelay ?? (ctx.isTouchDevice ? undefined : 150);
  const triggerProps = ctx.isTouchDevice
    ? ({
        nativeButton,
        openOnHover: true,
      } satisfies PopoverPrimitive.Trigger.Props)
    : ({
        closeDelay: tooltipCloseDelay,
      } satisfies TooltipPrimitive.Trigger.Props);

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
            "relative w-fit max-w-xs overflow-visible rounded bg-foreground px-2.5 py-1.5 text-background text-xs selection:bg-background selection:text-foreground",
            "origin-[var(--transform-origin)]",
            "data-open:fade-in-0 data-open:zoom-in-95 data-open:animate-in",
            "data-closed:fade-out-0 data-closed:zoom-out-95 data-closed:animate-out",
            "data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2 data-[side=inline-start]:slide-in-from-right-2 data-[side=inline-end]:slide-in-from-left-2",
            className,
          )}
          {...props}
        >
          <Arrow className="size-2.5 translate-y-[calc(-50%_-_2px)] rotate-45 rounded-[2px] bg-foreground fill-foreground data-[side=bottom]:top-1 data-[side=inline-end]:top-1/2! data-[side=inline-start]:top-1/2! data-[side=left]:top-1/2! data-[side=right]:top-1/2! data-[side=inline-start]:-right-1 data-[side=left]:-right-1 data-[side=top]:-bottom-2.5 data-[side=inline-end]:-left-1 data-[side=right]:-left-1 data-[side=inline-end]:-translate-y-1/2 data-[side=inline-start]:-translate-y-1/2 data-[side=left]:-translate-y-1/2 data-[side=right]:-translate-y-1/2" />
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

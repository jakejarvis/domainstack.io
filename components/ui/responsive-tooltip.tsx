"use client";

import { Popover as PopoverPrimitive } from "@base-ui/react/popover";
import { Tooltip as TooltipPrimitive } from "@base-ui/react/tooltip";
import { createContext, useContext } from "react";
import { usePointerCapability } from "@/hooks/use-pointer-capability";
import { cn } from "@/lib/utils";

type ResponsiveTooltipContextValue = {
  isTouchDevice: boolean;
};

const ResponsiveTooltipContext =
  createContext<ResponsiveTooltipContextValue | null>(null);

type ResponsiveTooltipProps = {
  children?: React.ReactNode;
  open?: boolean;
  defaultOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
  onOpenChangeComplete?: (open: boolean) => void;
};

function ResponsiveTooltip({
  children,
  onOpenChange,
  onOpenChangeComplete,
  ...props
}: ResponsiveTooltipProps) {
  const { isTouchDevice } = usePointerCapability();

  return (
    <ResponsiveTooltipContext.Provider value={{ isTouchDevice }}>
      {isTouchDevice ? (
        <PopoverPrimitive.Root
          data-slot="responsive-tooltip"
          onOpenChange={(open) => onOpenChange?.(open)}
          onOpenChangeComplete={(open) => onOpenChangeComplete?.(open)}
          {...props}
        >
          {children}
        </PopoverPrimitive.Root>
      ) : (
        <TooltipPrimitive.Provider
          data-slot="responsive-tooltip-provider"
          delay={0}
        >
          <TooltipPrimitive.Root
            data-slot="responsive-tooltip"
            onOpenChange={(open) => onOpenChange?.(open)}
            onOpenChangeComplete={(open) => onOpenChangeComplete?.(open)}
            {...props}
          >
            {children}
          </TooltipPrimitive.Root>
        </TooltipPrimitive.Provider>
      )}
    </ResponsiveTooltipContext.Provider>
  );
}

type ResponsiveTooltipTriggerProps = Omit<
  TooltipPrimitive.Trigger.Props<unknown>,
  "handle"
> &
  Pick<PopoverPrimitive.Trigger.Props<unknown>, "nativeButton">;

function ResponsiveTooltipTrigger({
  nativeButton,
  ...props
}: ResponsiveTooltipTriggerProps) {
  const ctx = useContext(ResponsiveTooltipContext);
  if (!ctx) {
    throw new Error(
      "ResponsiveTooltipTrigger must be used within <ResponsiveTooltip>.",
    );
  }

  return ctx.isTouchDevice ? (
    <PopoverPrimitive.Trigger
      data-slot="responsive-tooltip-trigger"
      nativeButton={nativeButton}
      {...props}
    />
  ) : (
    <TooltipPrimitive.Trigger
      data-slot="responsive-tooltip-trigger"
      {...props}
    />
  );
}

type ResponsiveTooltipContentProps = TooltipPrimitive.Popup.Props &
  PopoverPrimitive.Popup.Props &
  Pick<
    TooltipPrimitive.Positioner.Props,
    "align" | "alignOffset" | "side" | "sideOffset"
  >;

function ResponsiveTooltipContent({
  className,
  side = "top",
  sideOffset = 4,
  align = "center",
  alignOffset = 0,
  children,
  ...props
}: ResponsiveTooltipContentProps) {
  const ctx = useContext(ResponsiveTooltipContext);
  if (!ctx) {
    throw new Error(
      "ResponsiveTooltipContent must be used within <ResponsiveTooltip>.",
    );
  }

  const popupClassName = cn(
    "relative z-50 w-fit max-w-xs overflow-visible rounded-md bg-foreground px-3 py-1.5 text-background text-xs",
    "origin-[var(--transform-origin)] transition-[transform,opacity] duration-200",
    "data-[ending-style]:opacity-0 data-[starting-style]:opacity-0",
    "data-[ending-style]:scale-95 data-[starting-style]:scale-95",
    className,
  );

  if (ctx.isTouchDevice) {
    return (
      <PopoverPrimitive.Portal>
        <PopoverPrimitive.Positioner
          sideOffset={sideOffset}
          align={align}
          alignOffset={alignOffset}
          side={side}
          className="isolate z-50"
        >
          <PopoverPrimitive.Popup
            data-slot="responsive-tooltip-content"
            className={popupClassName}
            {...props}
          >
            {children}
            <PopoverPrimitive.Arrow className="z-50 size-2.5 translate-y-[calc(-50%_-_2px)] rotate-45 rounded-[2px] bg-foreground fill-foreground data-[side=bottom]:top-1 data-[side=left]:top-1/2! data-[side=right]:top-1/2! data-[side=left]:-right-1 data-[side=top]:-bottom-2.5 data-[side=right]:-left-1 data-[side=left]:-translate-y-1/2 data-[side=right]:-translate-y-1/2" />
          </PopoverPrimitive.Popup>
        </PopoverPrimitive.Positioner>
      </PopoverPrimitive.Portal>
    );
  }

  return (
    <TooltipPrimitive.Portal>
      <TooltipPrimitive.Positioner
        sideOffset={sideOffset}
        align={align}
        alignOffset={alignOffset}
        side={side}
        className="isolate z-50"
      >
        <TooltipPrimitive.Popup
          data-slot="responsive-tooltip-content"
          className={popupClassName}
          {...props}
        >
          {children}
          <TooltipPrimitive.Arrow className="z-50 size-2.5 translate-y-[calc(-50%_-_2px)] rotate-45 rounded-[2px] bg-foreground fill-foreground data-[side=bottom]:top-1 data-[side=left]:top-1/2! data-[side=right]:top-1/2! data-[side=left]:-right-1 data-[side=top]:-bottom-2.5 data-[side=right]:-left-1 data-[side=left]:-translate-y-1/2 data-[side=right]:-translate-y-1/2" />
        </TooltipPrimitive.Popup>
      </TooltipPrimitive.Positioner>
    </TooltipPrimitive.Portal>
  );
}

export {
  ResponsiveTooltip,
  ResponsiveTooltipTrigger,
  ResponsiveTooltipContent,
};

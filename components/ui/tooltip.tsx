"use client";

import { Popover as PopoverPrimitive } from "@base-ui/react/popover";
import { Tooltip as TooltipPrimitive } from "@base-ui/react/tooltip";
import * as React from "react";
import { usePointerCapability } from "@/hooks/use-pointer-capability";
import { cn } from "@/lib/utils";

type HybridMode = "tooltip" | "popover";
type HybridRootProps = React.ComponentProps<typeof TooltipPrimitive.Root> &
  React.ComponentProps<typeof PopoverPrimitive.Root>;
type HybridTriggerProps = React.ComponentProps<
  typeof TooltipPrimitive.Trigger
> &
  React.ComponentProps<typeof PopoverPrimitive.Trigger>;
type HybridPositionerProps = React.ComponentProps<
  typeof TooltipPrimitive.Positioner
> &
  React.ComponentProps<typeof PopoverPrimitive.Positioner>;
type HybridPopupProps = React.ComponentProps<typeof TooltipPrimitive.Popup> &
  React.ComponentProps<typeof PopoverPrimitive.Popup>;

const HybridTooltipContext = React.createContext<{ mode: HybridMode } | null>(
  null,
);

function TooltipProvider({
  delayDuration = 0,
  ...props
}: Omit<React.ComponentProps<typeof TooltipPrimitive.Provider>, "delay"> & {
  delayDuration?: number;
}) {
  return (
    <TooltipPrimitive.Provider
      data-slot="tooltip-provider"
      delay={delayDuration}
      {...props}
    />
  );
}

function Tooltip({ ...props }: HybridRootProps) {
  const { isTouchDevice } = usePointerCapability();
  // Current heuristic: prefer popover on touch devices
  const mode: HybridMode = isTouchDevice ? "popover" : "tooltip";

  const { children, ...rest } = props;

  return (
    <TooltipProvider>
      <HybridTooltipContext.Provider value={{ mode }}>
        {mode === "tooltip" ? (
          <TooltipPrimitive.Root data-slot="tooltip" {...rest}>
            {children}
          </TooltipPrimitive.Root>
        ) : (
          <PopoverPrimitive.Root data-slot="tooltip" {...rest}>
            {children}
          </PopoverPrimitive.Root>
        )}
      </HybridTooltipContext.Provider>
    </TooltipProvider>
  );
}

function TooltipTrigger({ ...props }: HybridTriggerProps) {
  const ctx = React.useContext(HybridTooltipContext);
  const mode: HybridMode = ctx?.mode ?? "tooltip";

  return mode === "tooltip" ? (
    <TooltipPrimitive.Trigger data-slot="tooltip-trigger" {...props} />
  ) : (
    <PopoverPrimitive.Trigger data-slot="tooltip-trigger" {...props} />
  );
}

function TooltipContent({
  className,
  sideOffset = 0,
  children,
  hideArrow,
  side,
  align,
  alignOffset,
  collisionPadding,
  sticky,
  positionMethod,
  ...props
}: Pick<
  HybridPositionerProps,
  | "side"
  | "sideOffset"
  | "align"
  | "alignOffset"
  | "collisionPadding"
  | "sticky"
  | "positionMethod"
  | "className"
> & {
  hideArrow?: boolean;
  children?: React.ReactNode;
} & Omit<HybridPopupProps, "className" | "children">) {
  const ctx = React.useContext(HybridTooltipContext);
  const mode: HybridMode = ctx?.mode ?? "tooltip";

  const baseClasses = cn(
    "group z-50 w-fit whitespace-normal break-words rounded-md bg-primary px-3 py-1.5 text-primary-foreground text-xs outline-hidden selection:bg-background selection:text-foreground",
    "origin-[var(--transform-origin)] transition-[transform,opacity] duration-200",
    "data-[starting-style]:opacity-0 data-[ending-style]:opacity-0",
    "data-[starting-style]:scale-95 data-[ending-style]:scale-95",
    // Keep tooltips from overflowing the viewport on small screens.
    "max-w-[calc(100vw-2rem)] md:max-w-[28rem]",
  );
  const heightClampWrapperClasses = "max-h-[calc(100vh-2rem)] overflow-y-auto";
  const arrowClass =
    "z-50 size-2.5 rotate-45 rounded-[1px] bg-primary fill-primary translate-y-[calc(-50%_-_2px)]";

  if (mode === "tooltip") {
    return (
      <TooltipPrimitive.Portal>
        <TooltipPrimitive.Positioner
          side={side ?? "top"}
          sideOffset={sideOffset}
          align={align}
          alignOffset={alignOffset}
          collisionPadding={collisionPadding ?? 8}
          sticky={sticky}
          positionMethod={positionMethod}
        >
          <TooltipPrimitive.Popup
            data-slot="tooltip-content"
            className={cn(baseClasses, className)}
            {...props}
          >
            <div className={heightClampWrapperClasses}>{children}</div>
            {hideArrow ? null : (
              <TooltipPrimitive.Arrow className={arrowClass} />
            )}
          </TooltipPrimitive.Popup>
        </TooltipPrimitive.Positioner>
      </TooltipPrimitive.Portal>
    );
  }

  return (
    <PopoverPrimitive.Portal>
      <PopoverPrimitive.Positioner
        side={side ?? "top"}
        sideOffset={sideOffset}
        align={align}
        alignOffset={alignOffset}
        collisionPadding={collisionPadding ?? 8}
        sticky={sticky}
        positionMethod={positionMethod}
      >
        <PopoverPrimitive.Popup
          data-slot="tooltip-content"
          className={cn(baseClasses, className)}
          {...props}
        >
          <div className={heightClampWrapperClasses}>{children}</div>
          {hideArrow ? null : <PopoverPrimitive.Arrow className={arrowClass} />}
        </PopoverPrimitive.Popup>
      </PopoverPrimitive.Positioner>
    </PopoverPrimitive.Portal>
  );
}

export { Tooltip, TooltipTrigger, TooltipContent };

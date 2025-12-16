"use client";

import { Popover as PopoverPrimitive } from "@base-ui/react/popover";
import * as React from "react";
import { usePointerCapability } from "@/hooks/use-pointer-capability";
import { cn } from "@/lib/utils";

type TooltipRootProps = React.ComponentProps<typeof PopoverPrimitive.Root> & {
  /**
   * Open on hover for pointer devices. Defaults to true on pointer devices and false on touch.
   * Can be overridden per-trigger via <TooltipTrigger openOnHover ... />.
   */
  openOnHover?: boolean;
  /** Hover-open delay (ms) when openOnHover is enabled. */
  delay?: number;
  /** Hover-close delay (ms) when openOnHover is enabled. */
  closeDelay?: number;
};

type TooltipTriggerProps = React.ComponentProps<
  typeof PopoverPrimitive.Trigger
> & {
  /** Hover-open delay override (ms). */
  delay?: number;
  /** Hover-close delay override (ms). */
  closeDelay?: number;
};

type TooltipPositionerProps = React.ComponentProps<
  typeof PopoverPrimitive.Positioner
>;
type TooltipPopupProps = React.ComponentProps<typeof PopoverPrimitive.Popup>;

const TooltipContext = React.createContext<{
  openOnHover: boolean;
  delay: number;
  closeDelay: number;
} | null>(null);

function Tooltip({
  openOnHover,
  delay,
  closeDelay,
  ...props
}: TooltipRootProps) {
  const { isTouchDevice } = usePointerCapability();
  const resolvedOpenOnHover = openOnHover ?? !isTouchDevice;
  const resolvedDelay = delay ?? 0;
  const resolvedCloseDelay = closeDelay ?? 0;

  return (
    <TooltipContext.Provider
      value={{
        openOnHover: resolvedOpenOnHover,
        delay: resolvedDelay,
        closeDelay: resolvedCloseDelay,
      }}
    >
      <PopoverPrimitive.Root data-slot="tooltip" {...props} />
    </TooltipContext.Provider>
  );
}

function TooltipTrigger({
  openOnHover,
  delay,
  closeDelay,
  ...props
}: TooltipTriggerProps) {
  const ctx = React.useContext(TooltipContext);
  const resolvedOpenOnHover = openOnHover ?? ctx?.openOnHover ?? false;
  const resolvedDelay = delay ?? ctx?.delay ?? 0;
  const resolvedCloseDelay = closeDelay ?? ctx?.closeDelay ?? 0;

  return (
    <PopoverPrimitive.Trigger
      data-slot="tooltip-trigger"
      openOnHover={resolvedOpenOnHover}
      delay={resolvedDelay}
      closeDelay={resolvedCloseDelay}
      {...props}
    />
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
  TooltipPositionerProps,
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
} & Omit<TooltipPopupProps, "className" | "children">) {
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

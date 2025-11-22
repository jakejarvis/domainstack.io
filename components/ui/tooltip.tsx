"use client";

import {
  Popover as PopoverPrimitive,
  Tooltip as TooltipPrimitive,
} from "radix-ui";
import * as React from "react";
import { usePointerCapability } from "@/hooks/use-pointer-capability";
import { cn } from "@/lib/utils";

type HybridMode = "tooltip" | "popover";

const HybridTooltipContext = React.createContext<{ mode: HybridMode } | null>(
  null,
);

function TooltipProvider({
  delayDuration = 0,
  ...props
}: React.ComponentProps<typeof TooltipPrimitive.Provider>) {
  return (
    <TooltipPrimitive.Provider
      data-slot="tooltip-provider"
      delayDuration={delayDuration}
      {...props}
    />
  );
}

function Tooltip({
  ...props
}: React.ComponentProps<typeof TooltipPrimitive.Root>) {
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

function TooltipTrigger({
  ...props
}: React.ComponentProps<typeof TooltipPrimitive.Trigger>) {
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
  ...props
}: Pick<
  React.ComponentProps<typeof TooltipPrimitive.Content>,
  | "side"
  | "sideOffset"
  | "align"
  | "alignOffset"
  | "avoidCollisions"
  | "collisionPadding"
  | "sticky"
  | "className"
  | "children"
> & {
  hideArrow?: boolean;
} & React.ComponentPropsWithoutRef<"div">) {
  const ctx = React.useContext(HybridTooltipContext);
  const mode: HybridMode = ctx?.mode ?? "tooltip";

  const baseClasses =
    "group fade-in-0 zoom-in-95 data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2 z-50 w-fit animate-in whitespace-normal break-words max-w-[calc(100vw-2rem)] rounded-md bg-primary px-3 py-1.5 text-primary-foreground text-xs outline-hidden data-[state=closed]:animate-out selection:bg-background selection:text-foreground";
  const originClass =
    mode === "tooltip"
      ? "origin-(--radix-tooltip-content-transform-origin)"
      : "origin-(--radix-popover-content-transform-origin)";
  const widthClampClasses =
    mode === "tooltip"
      ? "max-w-[min(var(--radix-tooltip-content-available-width),calc(100vw-2rem))] md:max-w-[min(var(--radix-tooltip-content-available-width),28rem)]"
      : "max-w-[min(var(--radix-popover-content-available-width),calc(100vw-2rem))] md:max-w-[min(var(--radix-popover-content-available-width),28rem)]";
  const heightClampWrapperClasses =
    mode === "tooltip"
      ? "max-h-[min(var(--radix-tooltip-content-available-height),calc(100vh-2rem))] overflow-y-auto"
      : "max-h-[min(var(--radix-popover-content-available-height),calc(100vh-2rem))] overflow-y-auto";
  const arrowClass =
    "z-50 size-2.5 rotate-45 rounded-[1px] bg-primary fill-primary translate-y-[calc(-50%_-_2px)]";

  if (mode === "tooltip") {
    return (
      <TooltipPrimitive.Portal>
        <TooltipPrimitive.Content
          data-slot="tooltip-content"
          side={props.side ?? "top"}
          sideOffset={sideOffset}
          avoidCollisions
          collisionPadding={8}
          sticky="partial"
          className={cn(baseClasses, widthClampClasses, originClass, className)}
          {...props}
        >
          <div className={heightClampWrapperClasses}>{children}</div>
          {hideArrow ? null : <TooltipPrimitive.Arrow className={arrowClass} />}
        </TooltipPrimitive.Content>
      </TooltipPrimitive.Portal>
    );
  }

  return (
    <PopoverPrimitive.Portal>
      <PopoverPrimitive.Content
        data-slot="tooltip-content"
        side={props.side ?? "top"}
        sideOffset={sideOffset}
        avoidCollisions
        collisionPadding={8}
        sticky="partial"
        className={cn(baseClasses, widthClampClasses, originClass, className)}
        {...props}
      >
        <div className={heightClampWrapperClasses}>{children}</div>
        {hideArrow ? null : <PopoverPrimitive.Arrow className={arrowClass} />}
      </PopoverPrimitive.Content>
    </PopoverPrimitive.Portal>
  );
}

export { Tooltip, TooltipTrigger, TooltipContent };

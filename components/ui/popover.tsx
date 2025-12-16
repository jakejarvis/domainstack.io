"use client";

import { Popover as PopoverPrimitive } from "@base-ui/react/popover";
import * as React from "react";

import { cn } from "@/lib/utils";

const PopoverAnchorContext =
  React.createContext<React.RefObject<Element | null> | null>(null);

function Popover({
  ...props
}: React.ComponentProps<typeof PopoverPrimitive.Root>) {
  const anchorRef = React.useRef<Element | null>(null);
  return (
    <PopoverAnchorContext.Provider value={anchorRef}>
      <PopoverPrimitive.Root data-slot="popover" {...props} />
    </PopoverAnchorContext.Provider>
  );
}

function PopoverTrigger({
  ...props
}: React.ComponentProps<typeof PopoverPrimitive.Trigger>) {
  return <PopoverPrimitive.Trigger data-slot="popover-trigger" {...props} />;
}

function PopoverContent({
  className,
  align = "center",
  sideOffset = 4,
  side,
  anchor,
  alignOffset,
  collisionPadding,
  sticky,
  positionMethod,
  ...props
}: React.ComponentProps<typeof PopoverPrimitive.Popup> &
  Pick<
    React.ComponentProps<typeof PopoverPrimitive.Positioner>,
    | "align"
    | "alignOffset"
    | "anchor"
    | "side"
    | "sideOffset"
    | "collisionPadding"
    | "sticky"
    | "positionMethod"
  >) {
  const anchorRef = React.useContext(PopoverAnchorContext);
  const resolvedAnchor = anchor ?? anchorRef ?? undefined;

  return (
    <PopoverPrimitive.Portal>
      <PopoverPrimitive.Positioner
        align={align}
        alignOffset={alignOffset}
        side={side}
        sideOffset={sideOffset}
        anchor={resolvedAnchor}
        collisionPadding={collisionPadding}
        sticky={sticky}
        positionMethod={positionMethod}
      >
        <PopoverPrimitive.Popup
          data-slot="popover-content"
          className={cn(
            "z-50 w-72 rounded-md border bg-popover p-4 text-popover-foreground shadow-md outline-hidden",
            "origin-[var(--transform-origin)] transition-[transform,opacity] duration-200",
            "data-[ending-style]:opacity-0 data-[starting-style]:opacity-0",
            "data-[ending-style]:scale-95 data-[starting-style]:scale-95",
            className,
          )}
          {...props}
        />
      </PopoverPrimitive.Positioner>
    </PopoverPrimitive.Portal>
  );
}

/**
 * Compatibility shim.
 * Radix had an explicit `Anchor` part; Base UI positions against the trigger or a supplied `anchor` on `Positioner`.
 * This export now wires through to `PopoverContent` by setting `Positioner`'s `anchor` prop.
 */
const PopoverAnchor = React.forwardRef<
  React.ElementRef<"span">,
  React.ComponentPropsWithoutRef<"span">
>(function PopoverAnchor({ ...props }, forwardedRef) {
  const anchorRef = React.useContext(PopoverAnchorContext);

  return (
    <span
      data-slot="popover-anchor"
      ref={(node) => {
        if (anchorRef) {
          (anchorRef as React.MutableRefObject<Element | null>).current = node;
        }

        if (typeof forwardedRef === "function") {
          forwardedRef(node);
        } else if (forwardedRef) {
          (
            forwardedRef as React.MutableRefObject<HTMLSpanElement | null>
          ).current = node;
        }
      }}
      {...props}
    />
  );
});

export { Popover, PopoverTrigger, PopoverContent, PopoverAnchor };

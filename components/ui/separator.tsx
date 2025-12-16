"use client";

import type * as React from "react";

import { cn } from "@/lib/utils";

type SeparatorProps = React.ComponentPropsWithoutRef<"div"> & {
  orientation?: "horizontal" | "vertical";
  decorative?: boolean;
};

type NonDecorativeSeparatorProps = Omit<SeparatorProps, "decorative"> & {
  decorative: false;
};

function Separator({
  className,
  orientation = "horizontal",
  decorative = true,
  ...props
}: SeparatorProps | NonDecorativeSeparatorProps) {
  if (decorative) {
    return (
      <div
        data-slot="separator"
        role="presentation"
        aria-hidden={true}
        data-orientation={orientation}
        className={cn(
          "shrink-0 bg-border data-[orientation=horizontal]:h-px data-[orientation=vertical]:h-full data-[orientation=horizontal]:w-full data-[orientation=vertical]:w-px",
          className,
        )}
        {...props}
      />
    );
  }

  const ariaOrientation = orientation as "horizontal" | "vertical";
  return (
    <div
      data-slot="separator"
      role="separator"
      tabIndex={-1}
      aria-orientation={ariaOrientation}
      aria-valuenow={0}
      data-orientation={orientation}
      className={cn(
        "shrink-0 bg-border data-[orientation=horizontal]:h-px data-[orientation=vertical]:h-full data-[orientation=horizontal]:w-full data-[orientation=vertical]:w-px",
        className,
      )}
      {...props}
    />
  );
}

export { Separator };

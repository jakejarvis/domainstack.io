"use client";

import { useRender } from "@base-ui/react/use-render";
import { cva, type VariantProps } from "class-variance-authority";
import { motion } from "motion/react";
import { useLayoutEffect, useRef, useState } from "react";
import { Separator, type SeparatorProps } from "@/components/ui/separator";
import { cn } from "@/lib/utils";

const buttonGroupVariants = cva(
  "flex w-fit items-stretch [&>*]:focus-visible:relative [&>*]:focus-visible:z-10 [&>[data-slot=select-trigger]:not([class*='w-'])]:w-fit [&>input]:flex-1 has-[select[aria-hidden=true]:last-child]:[&>[data-slot=select-trigger]:last-of-type]:rounded-r-md has-[>[data-slot=button-group]]:gap-2",
  {
    variants: {
      orientation: {
        horizontal:
          "[&>*:not([data-slot=button-group-indicator]):not(:first-child)]:rounded-l-none [&>*:not([data-slot=button-group-indicator]):not(:first-child)]:border-l-0 [&>*:not([data-slot=button-group-indicator]):not(:last-child)]:rounded-r-none",
        vertical:
          "flex-col [&>*:not([data-slot=button-group-indicator]):not(:first-child)]:rounded-t-none [&>*:not([data-slot=button-group-indicator]):not(:first-child)]:border-t-0 [&>*:not([data-slot=button-group-indicator]):not(:last-child)]:rounded-b-none",
      },
    },
    defaultVariants: {
      orientation: "horizontal",
    },
  },
);

function ButtonGroup({
  className,
  orientation,
  children,
  withActiveIndicator = false,
  indicatorClassName,
  ...props
}: React.ComponentPropsWithoutRef<"div"> &
  VariantProps<typeof buttonGroupVariants> & {
    /**
     * Enables a segmented-control style animated pill behind the active item.
     * Detects active items by checking (in order):
     * - aria-pressed="true"
     * - data-state="on"
     * - data-state="active"
     */
    withActiveIndicator?: boolean;
    /** Optional classes for the animated pill */
    indicatorClassName?: string;
  }) {
  const groupRef = useRef<HTMLDivElement | null>(null);
  const [indicatorRect, setIndicatorRect] = useState<{
    x: number;
    y: number;
    width: number;
    height: number;
  } | null>(null);

  useLayoutEffect(() => {
    if (!withActiveIndicator) return;
    const group = groupRef.current;
    if (!group) return;

    let rafId: number | null = null;

    const updateIndicator = () => {
      if (rafId !== null) cancelAnimationFrame(rafId);
      rafId = requestAnimationFrame(() => {
        rafId = null;

        const active =
          (group.querySelector(
            '[aria-pressed="true"]',
          ) as HTMLElement | null) ??
          (group.querySelector('[data-state="on"]') as HTMLElement | null) ??
          (group.querySelector('[data-state="active"]') as HTMLElement | null);

        if (!active) {
          setIndicatorRect(null);
          return;
        }

        // Prefer offset* metrics (pixel-perfect in layout coords) to avoid subtle
        // sub-pixel drift from getBoundingClientRect() across browsers/zoom levels.
        if (active.offsetParent === group) {
          if (active.offsetWidth <= 0 || active.offsetHeight <= 0) return;
          setIndicatorRect({
            x: active.offsetLeft,
            y: active.offsetTop,
            width: active.offsetWidth,
            height: active.offsetHeight,
          });
          return;
        }

        // Fallback: compute relative rects
        const groupRect = group.getBoundingClientRect();
        const activeRect = active.getBoundingClientRect();

        if (activeRect.width <= 0 || activeRect.height <= 0) return;

        setIndicatorRect({
          x: activeRect.left - groupRect.left,
          y: activeRect.top - groupRect.top,
          width: activeRect.width,
          height: activeRect.height,
        });
      });
    };

    updateIndicator();

    const resizeObserver = new ResizeObserver(updateIndicator);
    resizeObserver.observe(group);

    const mutationObserver = new MutationObserver(updateIndicator);
    mutationObserver.observe(group, {
      subtree: true,
      attributes: true,
      attributeFilter: ["aria-pressed", "data-state", "class"],
    });

    window.addEventListener("resize", updateIndicator);

    return () => {
      if (rafId !== null) cancelAnimationFrame(rafId);
      resizeObserver.disconnect();
      mutationObserver.disconnect();
      window.removeEventListener("resize", updateIndicator);
    };
  }, [withActiveIndicator]);

  return (
    <div
      role="group"
      data-slot="button-group"
      data-orientation={orientation}
      className={cn(
        buttonGroupVariants({ orientation }),
        withActiveIndicator &&
          "relative overflow-hidden [&>*:not([data-slot=button-group-indicator])]:relative [&>*:not([data-slot=button-group-indicator])]:z-10",
        className,
      )}
      ref={groupRef}
      {...props}
    >
      {withActiveIndicator && (
        <motion.span
          aria-hidden="true"
          data-slot="button-group-indicator"
          className={cn(
            "pointer-events-none absolute top-0 left-0 z-0 rounded-md",
            "bg-background/90 shadow-sm ring-1 ring-black/10",
            "dark:bg-white/10 dark:shadow-none dark:ring-white/15",
            "will-change-[transform,width,height]",
            indicatorClassName,
          )}
          initial={false}
          animate={
            indicatorRect
              ? {
                  opacity: 1,
                  x: indicatorRect.x,
                  y: indicatorRect.y,
                  width: indicatorRect.width,
                  height: indicatorRect.height,
                }
              : { opacity: 0 }
          }
          // Use a tween to avoid spring overshoot increasing scroll size and
          // subtly shifting adjacent layout in tight flex rows.
          transition={{ duration: 0.18, ease: [0.22, 1, 0.36, 1] as const }}
        />
      )}
      {children}
    </div>
  );
}

function ButtonGroupText({
  className,
  render,
  ...props
}: React.ComponentPropsWithoutRef<"div"> & {
  render?: React.ReactElement;
}) {
  return useRender({
    defaultTagName: "div",
    render,
    props: {
      className: cn(
        "flex items-center gap-2 rounded-md border bg-muted px-4 font-medium text-sm shadow-xs [&_svg:not([class*='size-'])]:size-4 [&_svg]:pointer-events-none",
        className,
      ),
      ...props,
    },
  });
}

function ButtonGroupSeparator({
  className,
  orientation = "vertical",
  ...props
}: SeparatorProps) {
  return (
    <Separator
      data-slot="button-group-separator"
      orientation={orientation}
      className={cn(
        "!m-0 relative self-stretch bg-input data-[orientation=vertical]:h-auto",
        className,
      )}
      {...props}
    />
  );
}

export {
  ButtonGroup,
  ButtonGroupSeparator,
  ButtonGroupText,
  buttonGroupVariants,
};

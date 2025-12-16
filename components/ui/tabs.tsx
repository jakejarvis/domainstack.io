"use client";

import { Tabs as TabsPrimitive } from "@base-ui/react/tabs";
import { motion } from "motion/react";
import type * as React from "react";
import { useEffect, useLayoutEffect, useRef, useState } from "react";

import { cn } from "@/lib/utils";

function Tabs({
  className,
  ...props
}: React.ComponentProps<typeof TabsPrimitive.Root>) {
  return (
    <TabsPrimitive.Root
      data-slot="tabs"
      className={cn("flex flex-col gap-2", className)}
      {...props}
    />
  );
}

function TabsList({
  className,
  children,
  ...props
}: React.ComponentProps<typeof TabsPrimitive.List>) {
  const listRef = useRef<HTMLDivElement | null>(null);
  const [indicatorRect, setIndicatorRect] = useState<{
    x: number;
    y: number;
    width: number;
    height: number;
  } | null>(null);
  const [shouldAnimateIndicator, setShouldAnimateIndicator] = useState(false);

  // Don't animate the indicator the first time we measure it (prevents the
  // "grow from top-left" effect when the tabs bar first mounts/appears).
  useEffect(() => {
    if (indicatorRect && !shouldAnimateIndicator) {
      setShouldAnimateIndicator(true);
    }
    if (!indicatorRect && shouldAnimateIndicator) {
      setShouldAnimateIndicator(false);
    }
  }, [indicatorRect, shouldAnimateIndicator]);

  useLayoutEffect(() => {
    const list = listRef.current;
    if (!list) return;

    let rafId: number | null = null;

    const updateIndicator = () => {
      if (rafId !== null) cancelAnimationFrame(rafId);
      rafId = requestAnimationFrame(() => {
        rafId = null;

        const active =
          (list.querySelector(
            '[data-slot="tabs-trigger"][data-active]',
          ) as HTMLElement | null) ??
          (list.querySelector("[data-active]") as HTMLElement | null);

        if (!active) {
          setIndicatorRect(null);
          return;
        }

        // Prefer offset* metrics (pixel-perfect in layout coords) to avoid subtle
        // sub-pixel drift from getBoundingClientRect() across browsers/zoom levels.
        if (active.offsetParent === list) {
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
        const listRect = list.getBoundingClientRect();
        const activeRect = active.getBoundingClientRect();

        if (activeRect.width <= 0 || activeRect.height <= 0) return;

        setIndicatorRect({
          x: activeRect.left - listRect.left,
          y: activeRect.top - listRect.top,
          width: activeRect.width,
          height: activeRect.height,
        });
      });
    };

    updateIndicator();

    const resizeObserver = new ResizeObserver(updateIndicator);
    resizeObserver.observe(list);

    const mutationObserver = new MutationObserver(updateIndicator);
    mutationObserver.observe(list, {
      subtree: true,
      attributes: true,
      attributeFilter: ["data-active"],
    });

    window.addEventListener("resize", updateIndicator);

    return () => {
      if (rafId !== null) cancelAnimationFrame(rafId);
      resizeObserver.disconnect();
      mutationObserver.disconnect();
      window.removeEventListener("resize", updateIndicator);
    };
  }, []);

  return (
    <TabsPrimitive.List
      data-slot="tabs-list"
      className={cn(
        "relative inline-flex h-9 w-fit items-center justify-center rounded-lg bg-muted p-[3px] text-muted-foreground",
        className,
      )}
      ref={listRef}
      {...props}
    >
      <motion.span
        data-slot="tabs-indicator"
        aria-hidden="true"
        className={cn(
          "pointer-events-none absolute top-0 left-0 z-0 rounded-md",
          "bg-background/90 shadow-sm ring-1 ring-black/10",
          "dark:bg-white/10 dark:shadow-none dark:ring-white/15",
          "will-change-[transform,width,height]",
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
        transition={
          shouldAnimateIndicator
            ? { type: "spring", stiffness: 550, damping: 45 }
            : { duration: 0 }
        }
      />
      {children}
    </TabsPrimitive.List>
  );
}

function TabsTrigger({
  className,
  ...props
}: React.ComponentProps<typeof TabsPrimitive.Tab>) {
  return (
    <TabsPrimitive.Tab
      data-slot="tabs-trigger"
      className={cn(
        "relative z-10 inline-flex h-full flex-1 items-center justify-center gap-1.5 whitespace-nowrap rounded-md border border-transparent px-2 font-medium text-muted-foreground text-sm transition-[color,box-shadow] focus-visible:border-ring focus-visible:outline-1 focus-visible:outline-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:pointer-events-none disabled:opacity-50 data-[active]:text-foreground [&_svg:not([class*='size-'])]:size-4 [&_svg]:pointer-events-none [&_svg]:shrink-0",
        className,
      )}
      {...props}
    />
  );
}

function TabsContent({
  className,
  ...props
}: React.ComponentProps<typeof TabsPrimitive.Panel>) {
  return (
    <TabsPrimitive.Panel
      data-slot="tabs-content"
      className={cn("flex-1 outline-none", className)}
      {...props}
    />
  );
}

export { Tabs, TabsList, TabsTrigger, TabsContent };

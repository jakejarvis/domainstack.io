import { Toggle as TogglePrimitive } from "@base-ui/react/toggle";
import { ToggleGroup as ToggleGroupPrimitive } from "@base-ui/react/toggle-group";
import { motion } from "motion/react";
import {
  createContext,
  useContext,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { toggleVariants } from "@/components/ui/toggle";
import type { VariantProps } from "@/lib/utils";
import { cn } from "@/lib/utils";

const ToggleGroupContext = createContext<VariantProps<typeof toggleVariants>>({
  size: "default",
  variant: "default",
});

function ToggleGroup({
  className,
  variant,
  size,
  children,
  withActiveIndicator = false,
  indicatorClassName,
  ...props
}: ToggleGroupPrimitive.Props &
  VariantProps<typeof toggleVariants> & {
    /**
     * Enables a segmented-control style animated pill behind the active item.
     * Detects active items by checking (in order):
     * - aria-pressed="true"
     * - data-pressed (Base UI Toggle)
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
          (group.querySelector("[data-pressed]") as HTMLElement | null);

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
      attributeFilter: ["aria-pressed", "data-pressed", "class"],
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
    <ToggleGroupPrimitive
      data-slot="toggle-group"
      data-variant={variant}
      data-size={size}
      className={cn(
        "group/toggle-group flex w-fit items-stretch gap-1 rounded-md data-[variant=outline]:shadow-xs",
        withActiveIndicator &&
          "relative overflow-hidden rounded-lg border border-black/8 bg-muted/50 p-1 text-muted-foreground backdrop-blur-sm dark:border-white/10 [&>*:not([data-slot=toggle-group-indicator])]:relative [&>*:not([data-slot=toggle-group-indicator])]:z-10",
        className,
      )}
      ref={groupRef}
      {...props}
    >
      {withActiveIndicator && (
        <motion.span
          aria-hidden="true"
          data-slot="toggle-group-indicator"
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
      <ToggleGroupContext.Provider value={{ variant, size }}>
        {children}
      </ToggleGroupContext.Provider>
    </ToggleGroupPrimitive>
  );
}

function ToggleGroupItem({
  className,
  children,
  variant,
  size,
  ...props
}: TogglePrimitive.Props & VariantProps<typeof toggleVariants>) {
  const context = useContext(ToggleGroupContext);

  return (
    <TogglePrimitive
      data-slot="toggle-group-item"
      data-variant={context.variant || variant}
      data-size={context.size || size}
      className={cn(
        toggleVariants({
          variant: context.variant || variant,
          size: context.size || size,
        }),
        "min-w-0 flex-1 shrink-0 rounded-none shadow-none first:rounded-l-md last:rounded-r-md focus:z-10 focus-visible:z-10 data-[variant=outline]:border-l-0 data-[variant=outline]:first:border-l",
        className,
      )}
      {...props}
    >
      {children}
    </TogglePrimitive>
  );
}

export { ToggleGroup, ToggleGroupItem };

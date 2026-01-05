import { ScrollArea as ScrollAreaPrimitive } from "@base-ui/react/scroll-area";
import { cn } from "@/lib/utils";

interface ScrollAreaProps
  extends React.ComponentPropsWithoutRef<typeof ScrollAreaPrimitive.Root> {
  /** Enable edge fade that masks content into transparency (works on any background) */
  showFade?: boolean;
  showScrollbar?: boolean;
  viewportRef?: React.Ref<HTMLDivElement>;
}

function ScrollArea({
  className,
  children,
  showFade = true,
  showScrollbar = true,
  viewportRef,
  ...props
}: ScrollAreaProps) {
  return (
    <ScrollAreaPrimitive.Root
      data-slot="scroll-area"
      className={cn("relative flex flex-col overflow-hidden", className)}
      {...props}
    >
      <ScrollAreaPrimitive.Viewport
        data-slot="scroll-area-viewport"
        ref={viewportRef}
        className={cn(
          // Base styles
          "min-h-0 flex-1 overflow-auto overscroll-contain rounded-[inherit] outline-none",
          "scrollbar-hide",
          "focus-visible:outline-1 focus-visible:ring-[3px] focus-visible:ring-ring/50",
          // Edge fade masks - composed for both axes, invisible when no overflow
          showFade &&
            "mask-intersect mask-[linear-gradient(to_bottom,transparent,black_min(48px,var(--scroll-area-overflow-y-start,0)),black_calc(100%-min(48px,var(--scroll-area-overflow-y-end,0))),transparent),linear-gradient(to_right,transparent,black_min(48px,var(--scroll-area-overflow-x-start,0)),black_calc(100%-min(48px,var(--scroll-area-overflow-x-end,0))),transparent)] [-webkit-mask-composite:source-in]",
        )}
      >
        <ScrollAreaPrimitive.Content data-slot="scroll-area-content">
          {children}
        </ScrollAreaPrimitive.Content>
      </ScrollAreaPrimitive.Viewport>
      {showScrollbar && (
        <>
          <ScrollBar orientation="vertical" />
          <ScrollBar orientation="horizontal" />
        </>
      )}
      <ScrollAreaPrimitive.Corner />
    </ScrollAreaPrimitive.Root>
  );
}

function ScrollBar({
  className,
  orientation = "vertical",
  ...props
}: ScrollAreaPrimitive.Scrollbar.Props) {
  return (
    <ScrollAreaPrimitive.Scrollbar
      data-slot="scroll-area-scrollbar"
      orientation={orientation}
      className={cn(
        // Base styles - hidden by default, appears on hover/scrolling
        "pointer-events-none relative flex rounded-full bg-black/10 opacity-0 transition-opacity duration-150 dark:bg-white/15",
        // Larger hit area via pseudo-element
        "before:absolute before:content-['']",
        // Vertical orientation
        "data-[orientation=vertical]:m-2 data-[orientation=vertical]:w-1",
        "data-[orientation=vertical]:before:left-1/2 data-[orientation=vertical]:before:h-full data-[orientation=vertical]:before:w-5 data-[orientation=vertical]:before:-translate-x-1/2",
        // Horizontal orientation
        "data-[orientation=horizontal]:m-2 data-[orientation=horizontal]:h-1",
        "data-[orientation=horizontal]:before:right-0 data-[orientation=horizontal]:before:-bottom-2 data-[orientation=horizontal]:before:left-0 data-[orientation=horizontal]:before:h-5",
        // Show on hover or scrolling
        "data-[hovering]:pointer-events-auto data-[hovering]:opacity-100",
        "data-[scrolling]:pointer-events-auto data-[scrolling]:opacity-100 data-[scrolling]:duration-0",
        className,
      )}
      {...props}
    >
      <ScrollAreaPrimitive.Thumb
        data-slot="scroll-area-thumb"
        className="w-full rounded-full bg-black/40 dark:bg-white/40"
      />
    </ScrollAreaPrimitive.Scrollbar>
  );
}

export { ScrollArea, ScrollBar };

import { ScrollArea as ScrollAreaPrimitive } from "@base-ui/react/scroll-area";
import { cn, cva } from "@/lib/utils";

const scrollAreaViewportVariants = cva({
  base: "overscroll-contain rounded-[inherit] outline-none transition-[color,box-shadow] [-ms-overflow-style:none] [scrollbar-width:none] focus-visible:outline-1 focus-visible:ring-[3px] focus-visible:ring-ring/50 [&::-webkit-scrollbar]:hidden",
  variants: {
    orientation: {
      vertical: "min-h-0 flex-1 overflow-y-auto overflow-x-hidden",
      horizontal: "h-full w-full overflow-x-auto overflow-y-hidden",
    },
    gradient: {
      true: [
        // Inherit the CSS variables from Base UI
        "before:[--scroll-area-overflow-y-start:inherit] after:[--scroll-area-overflow-y-end:inherit]",
        "before:[--scroll-area-overflow-x-start:inherit] after:[--scroll-area-overflow-x-end:inherit]",
        // Required for pseudo-elements to render
        "before:content-[''] after:content-['']",
        "before:block after:block",
        // Positioning
        "before:absolute after:absolute",
        "before:pointer-events-none after:pointer-events-none",
        "before:z-10 after:z-10",
        // Transitions
        "before:transition-all after:transition-all",
        "before:duration-100 after:duration-100",
        "before:ease-out after:ease-out",
      ],
      false: "",
    },
    gradientContext: {
      background: "",
      card: "",
      popover: "",
    },
  },
  compoundVariants: [
    // Vertical gradient base styles
    {
      gradient: true,
      orientation: "vertical",
      className: [
        // Top gradient positioning
        "before:top-0 before:left-0 before:w-full before:rounded-[inherit]",
        "before:[height:min(48px,var(--scroll-area-overflow-y-start))]",
        "before:bg-gradient-to-b before:to-transparent",
        // Bottom gradient positioning
        "after:bottom-0 after:left-0 after:w-full after:rounded-[inherit]",
        "after:[height:min(48px,var(--scroll-area-overflow-y-end,48px))]",
        "after:bg-gradient-to-t after:to-transparent",
      ],
    },
    // Horizontal gradient base styles
    {
      gradient: true,
      orientation: "horizontal",
      className: [
        // Left gradient positioning
        "before:top-0 before:left-0 before:h-full before:rounded-[inherit]",
        "before:[width:min(48px,var(--scroll-area-overflow-x-start))]",
        "before:bg-gradient-to-r before:to-transparent",
        // Right gradient positioning
        "after:top-0 after:right-0 after:h-full after:rounded-[inherit]",
        "after:[width:min(48px,var(--scroll-area-overflow-x-end,48px))]",
        "after:bg-gradient-to-l after:to-transparent",
      ],
    },
    // Context-specific gradient colors (apply to both orientations)
    {
      gradient: true,
      gradientContext: "background",
      className: "before:from-background after:from-background",
    },
    {
      gradient: true,
      gradientContext: "card",
      className: "before:from-card after:from-card",
    },
    {
      gradient: true,
      gradientContext: "popover",
      className: "before:from-popover after:from-popover",
    },
  ],
  defaultVariants: {
    orientation: "vertical",
    gradient: false,
    gradientContext: "background",
  },
});

interface ScrollAreaProps
  extends React.ComponentPropsWithoutRef<typeof ScrollAreaPrimitive.Root> {
  orientation?: "vertical" | "horizontal";
  /** Enable edge gradients that fade content into the background */
  gradient?: boolean;
  /** Which background context the scroll area is on - determines gradient color */
  gradientContext?: "background" | "card" | "popover";
  showScrollbar?: boolean;
  viewportRef?: React.Ref<HTMLDivElement>;
}

function ScrollArea({
  className,
  children,
  orientation = "vertical",
  gradient = false,
  gradientContext = "background",
  showScrollbar = true,
  viewportRef,
  ...props
}: ScrollAreaProps) {
  return (
    <ScrollAreaPrimitive.Root
      data-slot="scroll-area"
      className={cn(
        "relative overflow-hidden",
        orientation === "vertical" && "flex flex-col",
        className,
      )}
      {...props}
    >
      <ScrollAreaPrimitive.Viewport
        data-slot="scroll-area-viewport"
        ref={viewportRef}
        className={scrollAreaViewportVariants({
          orientation,
          gradient,
          gradientContext,
        })}
      >
        <ScrollAreaPrimitive.Content data-slot="scroll-area-content">
          {children}
        </ScrollAreaPrimitive.Content>
      </ScrollAreaPrimitive.Viewport>
      {showScrollbar && <ScrollBar orientation={orientation} />}
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
        // z-20 ensures scrollbar appears above gradients (which use z-10)
        "pointer-events-none relative z-20 flex rounded-full bg-black/10 opacity-0 transition-opacity duration-150 dark:bg-white/15",
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

export { ScrollArea, ScrollBar, scrollAreaViewportVariants };

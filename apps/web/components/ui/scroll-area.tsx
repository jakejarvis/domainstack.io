import { ScrollArea as ScrollAreaPrimitive } from "@base-ui/react/scroll-area";
import { cn } from "@/lib/utils";

function ScrollArea({
  className,
  children,
  scrollFade = true,
  scrollbarGutter = false,
  hideScrollbar = false,
  scrollRef,
  contentRef,
  ...props
}: ScrollAreaPrimitive.Root.Props & {
  /** Fade the edges of the scroll area to indicate scrollability */
  scrollFade?: boolean;
  /** Leave extra space for the scrollbar, instead of it covering the content */
  scrollbarGutter?: boolean;
  /** Completely hide scrollbars (useful for touch/gesture-only scroll areas) */
  hideScrollbar?: boolean;
  /** Ref for the outer viewport element */
  scrollRef?: React.Ref<HTMLDivElement>;
  /** Ref for the inner content element */
  contentRef?: React.Ref<HTMLDivElement>;
}) {
  return (
    <ScrollAreaPrimitive.Root
      data-slot="scroll-area"
      className={cn("relative flex min-h-0 min-w-0 overflow-hidden", className)}
      {...props}
    >
      <ScrollAreaPrimitive.Viewport
        data-slot="scroll-area-viewport"
        ref={scrollRef}
        className={cn(
          "no-scrollbar flex-1 rounded-[inherit] outline-none focus-visible:outline-1 focus-visible:ring-[3px] focus-visible:ring-ring/50 data-has-overflow-x:overscroll-x-contain",
          scrollFade &&
            "mask-t-from-[calc(100%-min(var(--fade-size),var(--scroll-area-overflow-y-start)))] mask-b-from-[calc(100%-min(var(--fade-size),var(--scroll-area-overflow-y-end)))] mask-l-from-[calc(100%-min(var(--fade-size),var(--scroll-area-overflow-x-start)))] mask-r-from-[calc(100%-min(var(--fade-size),var(--scroll-area-overflow-x-end)))] [--fade-size:1.5rem]",
          scrollbarGutter &&
            "data-has-overflow-y:pr-2.5 data-has-overflow-x:pb-2.5",
        )}
      >
        <ScrollAreaPrimitive.Content
          data-slot="scroll-area-content"
          ref={contentRef}
        >
          {children}
        </ScrollAreaPrimitive.Content>
      </ScrollAreaPrimitive.Viewport>
      {!hideScrollbar && (
        <>
          <ScrollBar orientation="vertical" />
          <ScrollBar orientation="horizontal" />
        </>
      )}
      <ScrollAreaPrimitive.Corner data-slot="scroll-area-corner" />
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
        "m-1 flex opacity-0 transition-opacity delay-300 data-[orientation=horizontal]:h-1 data-[orientation=vertical]:w-1 data-[orientation=horizontal]:flex-col data-hovering:opacity-100 data-scrolling:opacity-100 data-hovering:delay-0 data-scrolling:delay-0 data-hovering:duration-100 data-scrolling:duration-100",
        className,
      )}
      {...props}
    >
      <ScrollAreaPrimitive.Thumb
        data-slot="scroll-area-thumb"
        className="relative flex-1 rounded-full bg-black/40 dark:bg-white/40"
      />
    </ScrollAreaPrimitive.Scrollbar>
  );
}

export { ScrollArea, ScrollBar };

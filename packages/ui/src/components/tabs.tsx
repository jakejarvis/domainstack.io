import { Tabs as TabsPrimitive } from "@base-ui/react/tabs";
import { cn, cva, type VariantProps } from "../utils";
import { ScrollArea } from "./scroll-area";

function Tabs({
  className,
  orientation = "horizontal",
  ...props
}: TabsPrimitive.Root.Props) {
  return (
    <TabsPrimitive.Root
      data-slot="tabs"
      data-orientation={orientation}
      orientation={orientation}
      className={cn(
        "group/tabs flex gap-2 data-[orientation=horizontal]:flex-col",
        className,
      )}
      {...props}
    />
  );
}

const tabsListVariants = cva({
  base: "group/tabs-list relative inline-flex items-center text-muted-foreground group-data-[orientation=vertical]/tabs:h-fit group-data-[orientation=vertical]/tabs:flex-col",
  variants: {
    variant: {
      default:
        "h-9 w-fit justify-center rounded-lg border border-black/8 bg-muted/40 p-1 backdrop-blur-sm dark:border-white/10",
      line: "h-10 w-full gap-1.5 border-muted border-b bg-transparent",
    },
  },
  defaultVariants: {
    variant: "default",
  },
});

function TabsList({
  className,
  children,
  variant = "default",
  ...props
}: TabsPrimitive.List.Props & VariantProps<typeof tabsListVariants>) {
  const indicator = (
    <TabsPrimitive.Indicator
      data-slot="tabs-indicator"
      aria-hidden
      renderBeforeHydration
      className={cn(
        "pointer-events-none absolute left-[var(--active-tab-left)] z-0 w-[var(--active-tab-width)] transition-[width,height,top,left] duration-200 ease-out will-change-[transform,width,height]",
        // Default variant: pill background
        variant === "default" &&
          "top-[var(--active-tab-top)] h-[var(--active-tab-height)] rounded-md bg-muted shadow-sm ring-1 ring-black/5 dark:shadow-none dark:ring-white/10",
        // Line variant: underline that sits on top of the border
        variant === "line" && "bottom-0 h-0.5 bg-foreground",
      )}
    />
  );

  // Line variant uses ScrollArea for horizontal scrolling with gradient fades
  if (variant === "line") {
    return (
      <ScrollArea className="w-full" hideScrollbar scrollFade>
        <TabsPrimitive.List
          data-slot="tabs-list"
          data-variant={variant}
          className={cn(tabsListVariants({ variant }), className)}
          {...props}
        >
          {indicator}
          {children}
        </TabsPrimitive.List>
      </ScrollArea>
    );
  }

  return (
    <TabsPrimitive.List
      data-slot="tabs-list"
      data-variant={variant}
      className={cn(tabsListVariants({ variant }), className)}
      {...props}
    >
      {indicator}
      {children}
    </TabsPrimitive.List>
  );
}

function TabsTrigger({ className, ...props }: TabsPrimitive.Tab.Props) {
  return (
    <TabsPrimitive.Tab
      data-slot="tabs-trigger"
      className={cn(
        // Base styles
        "relative z-10 inline-flex h-full flex-1 cursor-pointer items-center justify-center gap-1.5 whitespace-nowrap rounded-md border border-transparent px-2 font-medium text-muted-foreground text-sm transition-colors",
        // Focus styles
        "focus-visible:border-ring focus-visible:outline-1 focus-visible:outline-ring focus-visible:ring-[3px] focus-visible:ring-ring/50",
        // Disabled styles
        "disabled:pointer-events-none disabled:opacity-50 aria-disabled:pointer-events-none aria-disabled:opacity-50",
        // Active styles
        "data-[active]:cursor-default data-[active]:text-foreground",
        // Icon styles
        "[&_svg:not([class*='size-'])]:size-4 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg]:text-muted-foreground/70 data-[active]:[&_svg]:text-foreground",
        // Vertical orientation
        "group-data-[orientation=vertical]/tabs:w-full group-data-[orientation=vertical]/tabs:justify-start",
        className,
      )}
      {...props}
    />
  );
}

function TabsContent({ className, ...props }: TabsPrimitive.Panel.Props) {
  return (
    <TabsPrimitive.Panel
      data-slot="tabs-content"
      className={cn("flex-1 text-sm outline-none", className)}
      {...props}
    />
  );
}

export { Tabs, TabsList, TabsTrigger, TabsContent, tabsListVariants };

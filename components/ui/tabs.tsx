import { Tabs as TabsPrimitive } from "@base-ui/react/tabs";
import { cn } from "@/lib/utils";

function Tabs({ className, ...props }: TabsPrimitive.Root.Props) {
  return (
    <TabsPrimitive.Root
      data-slot="tabs"
      className={cn("flex flex-col gap-2", className)}
      {...props}
    />
  );
}

function TabsList({ className, children, ...props }: TabsPrimitive.List.Props) {
  return (
    <TabsPrimitive.List
      data-slot="tabs-list"
      className={cn(
        "relative inline-flex h-9 w-full items-center justify-center rounded-lg border border-black/8 bg-muted/50 p-1 text-muted-foreground backdrop-blur-sm dark:border-white/10",
        className,
      )}
      {...props}
    >
      <TabsPrimitive.Indicator
        data-slot="tabs-indicator"
        aria-hidden
        renderBeforeHydration
        className={cn(
          "pointer-events-none absolute top-0 left-0 z-0 rounded-md",
          "bg-background/90 shadow-sm ring-1 ring-black/10",
          "dark:bg-white/10 dark:shadow-none dark:ring-white/15",
          "will-change-[transform,width,height]",
          "transition-[width,height,top,left] duration-200 ease-out",
          "top-[var(--active-tab-top)] left-[var(--active-tab-left)]",
          "h-[var(--active-tab-height)] w-[var(--active-tab-width)]",
        )}
      />
      {children}
    </TabsPrimitive.List>
  );
}

function TabsTrigger({ className, ...props }: TabsPrimitive.Tab.Props) {
  return (
    <TabsPrimitive.Tab
      data-slot="tabs-trigger"
      className={cn(
        "relative z-10 inline-flex h-full flex-1 cursor-pointer items-center justify-center gap-1.5 whitespace-nowrap rounded-md border border-transparent px-2 font-medium text-muted-foreground text-sm transition-[color,box-shadow] focus-visible:border-ring focus-visible:outline-1 focus-visible:outline-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:pointer-events-none disabled:opacity-50 data-[active]:cursor-default data-[active]:text-foreground [&_svg:not([class*='size-'])]:size-4 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg]:text-muted-foreground/70 data-[active]:[&_svg]:text-foreground",
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
      className={cn("flex-1 outline-none", className)}
      {...props}
    />
  );
}

export { Tabs, TabsList, TabsTrigger, TabsContent };

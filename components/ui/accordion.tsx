import { Accordion as AccordionPrimitive } from "@base-ui/react/accordion";
import { CaretDownIcon } from "@phosphor-icons/react/ssr";
import { cn } from "@/lib/utils";

function Accordion({ ...props }: AccordionPrimitive.Root.Props) {
  return (
    <AccordionPrimitive.Root
      data-slot="accordion"
      suppressHydrationWarning
      {...props}
    />
  );
}

function AccordionItem({ className, ...props }: AccordionPrimitive.Item.Props) {
  return (
    <AccordionPrimitive.Item
      data-slot="accordion-item"
      className={cn("border-b last:border-b-0", className)}
      {...props}
    />
  );
}

function AccordionTrigger({
  className,
  children,
  ...props
}: AccordionPrimitive.Trigger.Props) {
  return (
    <AccordionPrimitive.Header className="flex">
      <AccordionPrimitive.Trigger
        data-slot="accordion-trigger"
        className={cn(
          "group relative flex flex-1 items-center justify-between gap-4 rounded-md py-4 pr-8 text-left font-medium text-sm outline-none transition-all hover:underline focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:pointer-events-none disabled:opacity-50 data-[panel-open]:pr-8 disabled:[&>svg]:hidden",
          className,
        )}
        {...props}
      >
        {children}
        <CaretDownIcon
          className="pointer-events-none absolute top-1/2 right-0 size-4 shrink-0 -translate-y-1/2 text-muted-foreground transition-transform duration-200 group-data-[panel-open]:rotate-180"
          aria-hidden="true"
        />
      </AccordionPrimitive.Trigger>
    </AccordionPrimitive.Header>
  );
}

function AccordionContent({
  className,
  children,
  ...props
}: AccordionPrimitive.Panel.Props) {
  return (
    <AccordionPrimitive.Panel
      data-slot="accordion-content"
      className="h-[var(--accordion-panel-height)] overflow-hidden text-sm transition-[height] duration-200 ease-out will-change-[height] data-[ending-style]:h-0 data-[starting-style]:h-0"
      {...props}
    >
      <div className={cn("pt-0 pb-4", className)}>{children}</div>
    </AccordionPrimitive.Panel>
  );
}

export { Accordion, AccordionItem, AccordionTrigger, AccordionContent };

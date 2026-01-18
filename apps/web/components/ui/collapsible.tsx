import { Collapsible as CollapsiblePrimitive } from "@base-ui/react/collapsible";
import { cn } from "@/lib/utils";

function Collapsible({ ...props }: CollapsiblePrimitive.Root.Props) {
  return <CollapsiblePrimitive.Root data-slot="collapsible" {...props} />;
}

function CollapsibleTrigger({ ...props }: CollapsiblePrimitive.Trigger.Props) {
  return (
    <CollapsiblePrimitive.Trigger data-slot="collapsible-trigger" {...props} />
  );
}

function CollapsibleContent({
  className,
  ...props
}: CollapsiblePrimitive.Panel.Props) {
  return (
    <CollapsiblePrimitive.Panel
      data-slot="collapsible-content"
      className={cn(
        "h-[var(--collapsible-panel-height)] overflow-hidden transition-[height] duration-200 ease-out will-change-[height]",
        "data-[ending-style]:h-0 data-[starting-style]:h-0",
        className,
      )}
      {...props}
    />
  );
}

export { Collapsible, CollapsibleTrigger, CollapsibleContent };

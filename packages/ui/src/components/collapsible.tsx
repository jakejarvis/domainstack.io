import { Collapsible as CollapsiblePrimitive } from "@base-ui/react/collapsible";

import { cn } from "../utils";

function Collapsible({ ...props }: CollapsiblePrimitive.Root.Props) {
  return <CollapsiblePrimitive.Root data-slot="collapsible" {...props} />;
}

function CollapsibleTrigger({ className, ...props }: CollapsiblePrimitive.Trigger.Props) {
  return (
    <CollapsiblePrimitive.Trigger
      data-slot="collapsible-trigger"
      className={cn("cursor-pointer select-none", className)}
      {...props}
    />
  );
}

function CollapsibleContent({ className, children, ...props }: CollapsiblePrimitive.Panel.Props) {
  return (
    <CollapsiblePrimitive.Panel
      data-slot="collapsible-content"
      className={cn(
        "grid grid-rows-[1fr] overflow-hidden transition-[grid-template-rows,opacity] duration-200 ease-out motion-reduce:transition-none",
        "data-[ending-style]:grid-rows-[0fr] data-[ending-style]:opacity-0 data-[starting-style]:grid-rows-[0fr] data-[starting-style]:opacity-0 data-closed:grid-rows-[0fr] data-closed:opacity-0",
        className,
      )}
      {...props}
    >
      <div className="min-h-0 overflow-hidden">{children}</div>
    </CollapsiblePrimitive.Panel>
  );
}

export { Collapsible, CollapsibleContent, CollapsibleTrigger };

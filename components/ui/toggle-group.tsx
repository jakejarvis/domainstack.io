import { Toggle as TogglePrimitive } from "@base-ui/react/toggle";
import { ToggleGroup as ToggleGroupPrimitive } from "@base-ui/react/toggle-group";
import { toggleVariants } from "@/components/ui/toggle";
import type { VariantProps } from "@/lib/utils";
import { cn } from "@/lib/utils";

function ToggleGroup({
  className,
  children,
  ...props
}: ToggleGroupPrimitive.Props) {
  return (
    <ToggleGroupPrimitive
      data-slot="toggle-group"
      className={cn(
        "group/toggle-group flex w-fit items-stretch gap-1 rounded-md data-[variant=outline]:shadow-xs",
        "relative overflow-hidden rounded-lg border border-black/8 bg-muted/50 p-1 text-muted-foreground backdrop-blur-sm dark:border-white/10",
        className,
      )}
      {...props}
    >
      {children}
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
  return (
    <TogglePrimitive
      data-slot="toggle-group-item"
      className={(state) =>
        cn(
          toggleVariants({
            variant,
            size,
          }),
          "min-w-0 flex-1 shrink-0 rounded-none shadow-none first:rounded-l-md last:rounded-r-md focus:z-10 focus-visible:z-10 data-[variant=outline]:border-l-0 data-[variant=outline]:first:border-l",
          "data-[pressed]:rounded-md data-[pressed]:bg-background/90 data-[pressed]:text-foreground data-[pressed]:shadow-sm data-[pressed]:ring-1 data-[pressed]:ring-black/10 dark:data-[pressed]:bg-white/10 dark:data-[pressed]:shadow-none dark:data-[pressed]:ring-white/15",
          typeof className === "function" ? className(state) : className,
        )
      }
      {...props}
    >
      {children}
    </TogglePrimitive>
  );
}

export { ToggleGroup, ToggleGroupItem };

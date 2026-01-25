import { Toggle as TogglePrimitive } from "@base-ui/react/toggle";
import { cn, cva, type VariantProps } from "@/lib/utils";

const toggleVariants = cva({
  base: "group/toggle inline-flex cursor-pointer items-center justify-center gap-2 whitespace-nowrap rounded-md font-medium text-sm outline-none transition-all hover:bg-muted hover:text-foreground focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:pointer-events-none disabled:opacity-50 aria-pressed:cursor-default aria-pressed:bg-muted aria-invalid:border-destructive aria-invalid:ring-destructive/20 data-[state=on]:bg-muted dark:aria-invalid:ring-destructive/40 [&_svg:not([class*='size-'])]:size-4 [&_svg]:pointer-events-none [&_svg]:shrink-0",
  variants: {
    variant: {
      default: "bg-transparent",
      secondary:
        "bg-background hover:bg-muted aria-pressed:bg-primary aria-pressed:text-primary-foreground dark:border-input dark:bg-input/30 dark:aria-pressed:bg-primary dark:aria-pressed:text-primary-foreground dark:hover:bg-input/50",
      outline: "border border-input bg-transparent hover:bg-muted",
    },
    size: {
      default: "h-9 min-w-9 px-2",
      sm: "h-8 min-w-8 px-1.5",
      lg: "h-10 min-w-10 px-2.5",
    },
  },
  defaultVariants: {
    variant: "default",
    size: "default",
  },
});

function Toggle({
  className,
  variant,
  size,
  ...props
}: TogglePrimitive.Props & VariantProps<typeof toggleVariants>) {
  return (
    <TogglePrimitive
      data-slot="toggle"
      className={cn(toggleVariants({ variant, size, className }))}
      {...props}
    />
  );
}

export { Toggle, toggleVariants };

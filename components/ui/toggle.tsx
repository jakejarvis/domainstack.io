import { Toggle as TogglePrimitive } from "@base-ui/react/toggle";
import { cn, cva, type VariantProps } from "@/lib/utils";

const toggleVariants = cva({
  base: "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md font-medium text-[13px] outline-none transition-[color,box-shadow] focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 aria-invalid:border-destructive aria-invalid:ring-destructive/20 data-[disabled]:pointer-events-none data-[disabled]:opacity-50 dark:aria-invalid:ring-destructive/40 [&_svg:not([class*='size-'])]:size-4 [&_svg]:pointer-events-none [&_svg]:shrink-0",
  variants: {
    variant: {
      default:
        "bg-transparent hover:bg-muted hover:text-muted-foreground data-[pressed]:bg-accent data-[pressed]:text-accent-foreground",
      outline:
        "border border-input bg-transparent shadow-xs hover:bg-accent hover:text-accent-foreground data-[pressed]:bg-accent data-[pressed]:text-accent-foreground",
      ghost:
        "bg-transparent hover:bg-transparent data-[pressed]:bg-transparent data-[pressed]:text-foreground",
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

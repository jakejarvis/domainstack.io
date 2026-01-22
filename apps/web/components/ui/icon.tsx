import { cn, cva, type VariantProps } from "@/lib/utils";

const iconVariants = cva({
  base: "inline-flex shrink-0 items-center justify-center rounded-md [&_svg]:pointer-events-none [&_svg]:shrink-0",
  variants: {
    variant: {
      default: "bg-primary/5 [&_svg:not([class*='text-'])]:text-primary",
      muted: "bg-muted/30 [&_svg:not([class*='text-'])]:text-foreground/80",
      destructive:
        "bg-destructive/10 [&_svg:not([class*='text-'])]:text-destructive",
      warning:
        "bg-amber-500/10 [&_svg:not([class*='text-'])]:text-amber-600 dark:[&_svg:not([class*='text-'])]:text-amber-400",
      success:
        "bg-success/10 [&_svg:not([class*='text-'])]:text-success-foreground",
    },
    size: {
      sm: "size-8 [&_svg:not([class*='size-'])]:size-4",
      default: "size-10 [&_svg:not([class*='size-'])]:size-5",
      lg: "size-12 [&_svg:not([class*='size-'])]:size-6",
      xl: "size-14 [&_svg:not([class*='size-'])]:size-7",
    },
  },
  defaultVariants: {
    variant: "default",
    size: "default",
  },
});

type IconProps = React.ComponentProps<"div"> &
  VariantProps<typeof iconVariants>;

function Icon({ variant, size, className, ...props }: IconProps) {
  return (
    <div
      data-slot="icon-badge"
      className={cn(iconVariants({ variant, size }), className)}
      {...props}
    />
  );
}

export { Icon, iconVariants };
export type { IconProps };

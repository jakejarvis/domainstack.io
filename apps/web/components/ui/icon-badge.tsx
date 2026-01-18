import { cn, cva, type VariantProps } from "@/lib/utils";

const iconBadgeVariants = cva({
  base: "inline-flex shrink-0 items-center justify-center [&_svg]:pointer-events-none [&_svg]:shrink-0",
  variants: {
    size: {
      sm: "size-8 [&_svg:not([class*='size-'])]:size-4",
      md: "size-10 [&_svg:not([class*='size-'])]:size-5",
      lg: "size-12 [&_svg:not([class*='size-'])]:size-6",
    },
    shape: {
      circle: "rounded-full",
      rounded: "rounded-lg",
    },
    color: {
      default:
        "bg-muted text-foreground [&_svg:not([class*='text-'])]:text-foreground/85",
      muted:
        "bg-muted/30 text-muted-foreground [&_svg:not([class*='text-'])]:text-muted-foreground",
      destructive:
        "bg-destructive/10 text-destructive [&_svg:not([class*='text-'])]:text-destructive",
      warning:
        "bg-amber-500/10 text-amber-600 dark:text-amber-400 [&_svg:not([class*='text-'])]:text-amber-600 dark:[&_svg:not([class*='text-'])]:text-amber-400",
      success:
        "bg-success/10 text-success-foreground [&_svg:not([class*='text-'])]:text-success-foreground",
      primary:
        "bg-primary/10 text-primary [&_svg:not([class*='text-'])]:text-primary",
    },
  },
  defaultVariants: {
    size: "md",
    shape: "circle",
    color: "default",
  },
});

type IconBadgeProps = React.ComponentProps<"div"> &
  VariantProps<typeof iconBadgeVariants>;

function IconBadge({
  size,
  shape,
  color,
  className,
  ...props
}: IconBadgeProps) {
  return (
    <div
      data-slot="icon-badge"
      className={cn(iconBadgeVariants({ size, shape, color }), className)}
      {...props}
    />
  );
}

export { IconBadge, iconBadgeVariants };
export type { IconBadgeProps };

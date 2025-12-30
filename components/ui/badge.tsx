import { mergeProps } from "@base-ui/react/merge-props";
import { useRender } from "@base-ui/react/use-render";
import { cn, cva, type VariantProps } from "@/lib/utils";

const badgeVariants = cva({
  base: "inline-flex w-fit shrink-0 items-center justify-center gap-1 overflow-hidden whitespace-nowrap rounded-md border px-2 py-0.5 font-medium text-xs leading-none transition-[color,box-shadow] focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 aria-invalid:border-destructive aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 [&>svg]:pointer-events-none [&>svg]:size-3",
  variants: {
    variant: {
      default:
        "border-transparent bg-primary text-primary-foreground [a]:hover:bg-primary/90",
      secondary:
        "border-transparent bg-secondary text-secondary-foreground [a]:hover:bg-secondary/90",
      destructive:
        "border-transparent bg-destructive text-white focus-visible:ring-destructive/20 dark:bg-destructive/60 dark:focus-visible:ring-destructive/40 [a]:hover:bg-destructive/90",
      outline:
        "text-foreground [a]:hover:bg-accent [a]:hover:text-accent-foreground",
      ghost:
        "hover:bg-muted hover:text-muted-foreground dark:hover:bg-muted/50",
      link: "text-primary underline-offset-4 hover:underline",
    },
  },
  defaultVariants: {
    variant: "default",
  },
});

function Badge({
  className,
  variant = "default",
  render,
  ...props
}: useRender.ComponentProps<"span"> & VariantProps<typeof badgeVariants>) {
  return useRender({
    defaultTagName: "span",
    render,
    props: mergeProps<"span">(
      {
        className: cn(badgeVariants({ variant }), className),
      },
      props,
    ),
    state: {
      slot: "badge",
      variant,
    },
  });
}

export { Badge, badgeVariants };

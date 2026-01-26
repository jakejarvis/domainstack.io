import { mergeProps } from "@base-ui/react/merge-props";
import { useRender } from "@base-ui/react/use-render";
import { cn, cva, type VariantProps } from "@/lib/utils";

const alertVariants = cva({
  base: "fade-in-0 slide-in-from-top-2 relative grid w-full animate-in grid-cols-[0_1fr] items-start gap-y-0.5 rounded-lg border bg-card/40 px-4 py-3 text-sm backdrop-blur-lg duration-200 has-[>svg]:grid-cols-[calc(var(--spacing)*4)_1fr] has-[>svg]:gap-x-2 [&>svg]:size-4 [&>svg]:translate-y-0.5 [&>svg]:text-current",
  variants: {
    variant: {
      default: "text-card-foreground",
      destructive: "text-destructive",
    },
  },
  defaultVariants: {
    variant: "default",
  },
});

function Alert({
  variant,
  className,
  render,
  ...props
}: useRender.ComponentProps<"div"> & VariantProps<typeof alertVariants>) {
  return useRender({
    defaultTagName: "div",
    render,
    props: mergeProps<"div">(props, {
      role: "alert",
      className: cn(alertVariants({ variant }), className),
    }),
    state: {
      slot: "alert",
      variant,
    },
  });
}

function AlertTitle({
  className,
  render,
  ...props
}: useRender.ComponentProps<"div">) {
  return useRender({
    defaultTagName: "div",
    render,
    props: mergeProps<"div">(props, {
      className: cn("col-start-2 line-clamp-1 min-h-4 font-medium", className),
    }),
    state: {
      slot: "alert-title",
    },
  });
}

function AlertDescription({
  className,
  render,
  ...props
}: useRender.ComponentProps<"div">) {
  return useRender({
    defaultTagName: "div",
    render,
    props: mergeProps<"div">(props, {
      className: cn(
        "col-start-2 grid justify-items-start gap-1 text-muted-foreground text-sm [&_p]:leading-relaxed",
        className,
      ),
    }),
    state: {
      slot: "alert-description",
    },
  });
}

export { Alert, AlertTitle, AlertDescription };

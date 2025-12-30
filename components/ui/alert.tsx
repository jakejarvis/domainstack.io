import { mergeProps } from "@base-ui/react/merge-props";
import { useRender } from "@base-ui/react/use-render";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const alertVariants = cva(
  "bg-card/40 backdrop-blur-lg relative w-full rounded-lg border px-4 py-3 text-sm grid has-[>svg]:grid-cols-[calc(var(--spacing)*4)_1fr] grid-cols-[0_1fr] has-[>svg]:gap-x-3 gap-y-0.5 items-start [&>svg]:size-4 [&>svg]:translate-y-0.5 [&>svg]:text-current",
  {
    variants: {
      variant: {
        default: "text-card-foreground",
        destructive: "text-destructive",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  },
);

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

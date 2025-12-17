import { mergeProps } from "@base-ui/react/merge-props";
import { useRender } from "@base-ui/react/use-render";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

function Empty({ className, render, ...props }: useRender.ComponentProps<"div">) {
  return useRender({
    defaultTagName: "div",
    render,
    props: mergeProps<"div">(props, {
      className: cn(
        "flex min-w-0 flex-1 flex-col items-center justify-center gap-6 text-balance rounded-lg border-dashed p-6 text-center md:p-12",
        className,
      ),
    }),
    state: {
      slot: "empty",
    },
  });
}

function EmptyHeader({
  className,
  render,
  ...props
}: useRender.ComponentProps<"div">) {
  return useRender({
    defaultTagName: "div",
    render,
    props: mergeProps<"div">(props, {
      className: cn(
        "flex max-w-sm flex-col items-center gap-2 text-center",
        className,
      ),
    }),
    state: {
      slot: "empty-header",
    },
  });
}

const emptyMediaVariants = cva(
  "flex shrink-0 items-center justify-center mb-2 [&_svg]:pointer-events-none [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default: "bg-transparent",
        icon: "bg-muted text-foreground flex size-10 shrink-0 items-center justify-center rounded-lg [&_svg:not([class*='size-'])]:size-6",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  },
);

function EmptyMedia({
  variant = "default",
  className,
  render,
  ...props
}: useRender.ComponentProps<"div"> & VariantProps<typeof emptyMediaVariants>) {
  return useRender({
    defaultTagName: "div",
    render,
    props: mergeProps<"div">(props, {
      className: cn(emptyMediaVariants({ variant }), className),
    }),
    state: {
      slot: "empty-icon",
      variant,
    },
  });
}

function EmptyTitle({ className, render, ...props }: useRender.ComponentProps<"div">) {
  return useRender({
    defaultTagName: "div",
    render,
    props: mergeProps<"div">(props, {
      className: cn("font-medium text-lg tracking-tight", className),
    }),
    state: {
      slot: "empty-title",
    },
  });
}

function EmptyDescription({
  className,
  render,
  ...props
}: useRender.ComponentProps<"div">) {
  return useRender({
    defaultTagName: "div",
    render,
    props: mergeProps<"div">(props, {
      className: cn(
        "text-muted-foreground text-sm/relaxed [&>a:hover]:text-primary [&>a]:underline [&>a]:underline-offset-4",
        className,
      ),
    }),
    state: {
      slot: "empty-description",
    },
  });
}

function EmptyContent({
  className,
  render,
  ...props
}: useRender.ComponentProps<"div">) {
  return useRender({
    defaultTagName: "div",
    render,
    props: mergeProps<"div">(props, {
      className: cn(
        "flex w-full min-w-0 max-w-sm flex-col items-center gap-4 text-balance text-sm",
        className,
      ),
    }),
    state: {
      slot: "empty-content",
    },
  });
}

export {
  Empty,
  EmptyHeader,
  EmptyTitle,
  EmptyDescription,
  EmptyContent,
  EmptyMedia,
};

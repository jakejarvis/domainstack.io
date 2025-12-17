import { mergeProps } from "@base-ui/react/merge-props";
import { useRender } from "@base-ui/react/use-render";
import { cva, type VariantProps } from "class-variance-authority";
import { Separator, type SeparatorProps } from "@/components/ui/separator";
import { cn } from "@/lib/utils";

function ItemGroup({ className, render, ...props }: useRender.ComponentProps<"div">) {
  return useRender({
    defaultTagName: "div",
    render,
    props: mergeProps<"div">(props, {
      role: "list",
      className: cn("group/item-group flex flex-col", className),
    }),
    state: {
      slot: "item-group",
    },
  });
}

function ItemSeparator({ className, ...props }: SeparatorProps) {
  return (
    <Separator
      aria-hidden="true"
      data-slot="item-separator"
      orientation="horizontal"
      className={cn("my-0", className)}
      {...props}
    />
  );
}

const itemVariants = cva(
  "group/item flex items-center border border-transparent text-sm rounded-md transition-colors [a]:hover:bg-accent/50 [a]:transition-colors duration-100 flex-wrap outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]",
  {
    variants: {
      variant: {
        default: "bg-transparent",
        outline: "border-border",
        muted: "bg-muted/50",
      },
      size: {
        default: "p-4 gap-4 ",
        sm: "py-3 px-4 gap-2.5",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

function Item({
  variant = "default",
  size = "default",
  className,
  render,
  ...props
}: useRender.ComponentProps<"div"> & VariantProps<typeof itemVariants>) {
  return useRender({
    defaultTagName: "div",
    render,
    props: mergeProps<"div">(props, {
      className: cn(itemVariants({ variant, size }), className),
    }),
    state: {
      slot: "item",
      variant,
      size,
    },
  });
}

const itemMediaVariants = cva(
  "flex shrink-0 items-center justify-center gap-2 group-has-[[data-slot=item-description]]/item:self-start [&_svg]:pointer-events-none group-has-[[data-slot=item-description]]/item:translate-y-0.5",
  {
    variants: {
      variant: {
        default: "bg-transparent",
        icon: "size-8 border rounded-sm bg-muted [&_svg:not([class*='size-'])]:size-4",
        image:
          "size-10 rounded-sm overflow-hidden [&_img]:size-full [&_img]:object-cover",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  },
);

function ItemMedia({
  variant = "default",
  className,
  render,
  ...props
}: useRender.ComponentProps<"div"> & VariantProps<typeof itemMediaVariants>) {
  return useRender({
    defaultTagName: "div",
    render,
    props: mergeProps<"div">(props, {
      className: cn(itemMediaVariants({ variant }), className),
    }),
    state: {
      slot: "item-media",
      variant,
    },
  });
}

function ItemContent({ className, render, ...props }: useRender.ComponentProps<"div">) {
  return useRender({
    defaultTagName: "div",
    render,
    props: mergeProps<"div">(props, {
      className: cn(
        "flex flex-1 flex-col gap-1 [&+[data-slot=item-content]]:flex-none",
        className,
      ),
    }),
    state: {
      slot: "item-content",
    },
  });
}

function ItemTitle({ className, render, ...props }: useRender.ComponentProps<"div">) {
  return useRender({
    defaultTagName: "div",
    render,
    props: mergeProps<"div">(props, {
      className: cn(
        "flex w-fit items-center gap-2 font-medium text-sm leading-snug",
        className,
      ),
    }),
    state: {
      slot: "item-title",
    },
  });
}

function ItemDescription({ className, render, ...props }: useRender.ComponentProps<"p">) {
  return useRender({
    defaultTagName: "p",
    render,
    props: mergeProps<"p">(props, {
      className: cn(
        "line-clamp-2 text-balance font-normal text-muted-foreground text-sm leading-normal",
        "[&>a:hover]:text-primary [&>a]:underline [&>a]:underline-offset-4",
        className,
      ),
    }),
    state: {
      slot: "item-description",
    },
  });
}

function ItemActions({ className, render, ...props }: useRender.ComponentProps<"div">) {
  return useRender({
    defaultTagName: "div",
    render,
    props: mergeProps<"div">(props, {
      className: cn("flex items-center gap-2", className),
    }),
    state: {
      slot: "item-actions",
    },
  });
}

function ItemHeader({ className, render, ...props }: useRender.ComponentProps<"div">) {
  return useRender({
    defaultTagName: "div",
    render,
    props: mergeProps<"div">(props, {
      className: cn(
        "flex basis-full items-center justify-between gap-2",
        className,
      ),
    }),
    state: {
      slot: "item-header",
    },
  });
}

function ItemFooter({ className, render, ...props }: useRender.ComponentProps<"div">) {
  return useRender({
    defaultTagName: "div",
    render,
    props: mergeProps<"div">(props, {
      className: cn(
        "flex basis-full items-center justify-between gap-2",
        className,
      ),
    }),
    state: {
      slot: "item-footer",
    },
  });
}

export {
  Item,
  ItemMedia,
  ItemContent,
  ItemActions,
  ItemGroup,
  ItemSeparator,
  ItemTitle,
  ItemDescription,
  ItemHeader,
  ItemFooter,
};

import { mergeProps } from "@base-ui/react/merge-props";
import { useRender } from "@base-ui/react/use-render";
import { Separator } from "@/components/ui/separator";
import { cn, cva, type VariantProps } from "@/lib/utils";

function ItemGroup({
  className,
  render,
  ...props
}: useRender.ComponentProps<"div">) {
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

function ItemSeparator({
  className,
  ...props
}: React.ComponentProps<typeof Separator>) {
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

const itemVariants = cva({
  base: "group/item flex flex-wrap items-center rounded-md border border-transparent text-sm outline-none transition-colors duration-100 focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 [a]:transition-colors [a]:hover:bg-accent/50",
  variants: {
    variant: {
      default: "bg-transparent",
      outline: "border-border",
      muted: "bg-muted/50",
    },
    size: {
      default: "gap-4 p-4",
      sm: "gap-2.5 px-4 py-3",
    },
  },
  defaultVariants: {
    variant: "default",
    size: "default",
  },
});

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

const itemMediaVariants = cva({
  base: "flex shrink-0 items-center justify-center gap-2 group-has-[[data-slot=item-description]]/item:translate-y-0.5 group-has-[[data-slot=item-description]]/item:self-start [&_svg]:pointer-events-none",
  variants: {
    variant: {
      default: "bg-transparent",
      icon: "size-8 rounded-sm border bg-muted [&_svg:not([class*='size-'])]:size-4",
      image:
        "size-10 overflow-hidden rounded-sm [&_img]:size-full [&_img]:object-cover",
    },
  },
  defaultVariants: {
    variant: "default",
  },
});

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

function ItemContent({
  className,
  render,
  ...props
}: useRender.ComponentProps<"div">) {
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

function ItemTitle({
  className,
  render,
  ...props
}: useRender.ComponentProps<"div">) {
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

function ItemDescription({
  className,
  render,
  ...props
}: useRender.ComponentProps<"p">) {
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

function ItemActions({
  className,
  render,
  ...props
}: useRender.ComponentProps<"div">) {
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

function ItemHeader({
  className,
  render,
  ...props
}: useRender.ComponentProps<"div">) {
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

function ItemFooter({
  className,
  render,
  ...props
}: useRender.ComponentProps<"div">) {
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

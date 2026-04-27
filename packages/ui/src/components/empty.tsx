import { mergeProps } from "@base-ui/react/merge-props";
import { useRender } from "@base-ui/react/use-render";

import { cn, cva } from "../utils";
import { Icon } from "./icon";

function Empty({ className, render, ...props }: useRender.ComponentProps<"div">) {
  return useRender({
    defaultTagName: "div",
    render,
    props: mergeProps<"div">(props, {
      className: cn(
        "flex min-w-0 flex-1 flex-col items-center justify-center gap-6 rounded-lg border-dashed p-6 text-center text-balance md:p-12",
        className,
      ),
    }),
    state: {
      slot: "empty",
    },
  });
}

function EmptyHeader({ className, render, ...props }: useRender.ComponentProps<"div">) {
  return useRender({
    defaultTagName: "div",
    render,
    props: mergeProps<"div">(props, {
      className: cn("flex max-w-sm flex-col items-center gap-2 text-center", className),
    }),
    state: {
      slot: "empty-header",
    },
  });
}

const emptyMediaVariants = cva({
  base: "mb-2 flex shrink-0 items-center justify-center [&_svg]:pointer-events-none [&_svg]:shrink-0",
  variants: {
    variant: {
      default: "bg-transparent",
    },
  },
  defaultVariants: {
    variant: "default",
  },
});

type EmptyMediaVariant = "default" | "icon";

interface EmptyMediaProps extends Omit<useRender.ComponentProps<"div">, "children"> {
  variant?: EmptyMediaVariant;
  children?: React.ReactNode;
}

function EmptyMedia({ variant = "default", className, children, ...props }: EmptyMediaProps) {
  // For icon variant, wrap children in IconBadge
  if (variant === "icon") {
    return (
      <Icon data-slot="empty-icon" className={cn("mb-2", className)}>
        {children}
      </Icon>
    );
  }

  return (
    <div
      data-slot="empty-icon"
      className={cn(emptyMediaVariants({ variant }), className)}
      {...props}
    >
      {children}
    </div>
  );
}

function EmptyTitle({ className, render, ...props }: useRender.ComponentProps<"div">) {
  return useRender({
    defaultTagName: "div",
    render,
    props: mergeProps<"div">(props, {
      className: cn("text-lg font-medium tracking-tight", className),
    }),
    state: {
      slot: "empty-title",
    },
  });
}

function EmptyDescription({ className, render, ...props }: useRender.ComponentProps<"div">) {
  return useRender({
    defaultTagName: "div",
    render,
    props: mergeProps<"div">(props, {
      className: cn(
        "text-sm/relaxed text-muted-foreground [&>a]:underline [&>a]:underline-offset-4 [&>a:hover]:text-primary",
        className,
      ),
    }),
    state: {
      slot: "empty-description",
    },
  });
}

function EmptyContent({ className, render, ...props }: useRender.ComponentProps<"div">) {
  return useRender({
    defaultTagName: "div",
    render,
    props: mergeProps<"div">(props, {
      className: cn(
        "flex w-full max-w-sm min-w-0 flex-col items-center gap-4 text-sm text-balance",
        className,
      ),
    }),
    state: {
      slot: "empty-content",
    },
  });
}

export { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle };

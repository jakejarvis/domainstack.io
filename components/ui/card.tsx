import { mergeProps } from "@base-ui/react/merge-props";
import { useRender } from "@base-ui/react/use-render";
import { cn } from "@/lib/utils";

function Card({ className, render, ...props }: useRender.ComponentProps<"div">) {
  return useRender({
    defaultTagName: "div",
    render,
    props: mergeProps<"div">(props, {
      className: cn(
        "flex flex-col gap-2 rounded-xl border bg-card py-6 text-card-foreground shadow-sm",
        className,
      ),
    }),
    state: {
      slot: "card",
    },
  });
}

function CardHeader({
  className,
  render,
  ...props
}: useRender.ComponentProps<"div">) {
  return useRender({
    defaultTagName: "div",
    render,
    props: mergeProps<"div">(props, {
      className: cn(
        "@container/card-header grid auto-rows-min grid-rows-[auto_auto] items-start gap-1.5 px-6 has-data-[slot=card-action]:grid-cols-[1fr_auto] [.border-b]:pb-6",
        className,
      ),
    }),
    state: {
      slot: "card-header",
    },
  });
}

function CardTitle({ className, render, ...props }: useRender.ComponentProps<"div">) {
  return useRender({
    defaultTagName: "div",
    render,
    props: mergeProps<"div">(props, {
      className: cn("font-semibold leading-none", className),
    }),
    state: {
      slot: "card-title",
    },
  });
}

function CardDescription({
  className,
  render,
  ...props
}: useRender.ComponentProps<"div">) {
  return useRender({
    defaultTagName: "div",
    render,
    props: mergeProps<"div">(props, {
      className: cn("text-muted-foreground text-sm", className),
    }),
    state: {
      slot: "card-description",
    },
  });
}

function CardAction({ className, render, ...props }: useRender.ComponentProps<"div">) {
  return useRender({
    defaultTagName: "div",
    render,
    props: mergeProps<"div">(props, {
      className: cn(
        "col-start-2 row-span-2 row-start-1 self-start justify-self-end",
        className,
      ),
    }),
    state: {
      slot: "card-action",
    },
  });
}

function CardContent({
  className,
  render,
  ...props
}: useRender.ComponentProps<"div">) {
  return useRender({
    defaultTagName: "div",
    render,
    props: mergeProps<"div">(props, {
      className: cn("px-6", className),
    }),
    state: {
      slot: "card-content",
    },
  });
}

function CardFooter({
  className,
  render,
  ...props
}: useRender.ComponentProps<"div">) {
  return useRender({
    defaultTagName: "div",
    render,
    props: mergeProps<"div">(props, {
      className: cn("flex items-center px-6 [.border-t]:pt-6", className),
    }),
    state: {
      slot: "card-footer",
    },
  });
}

export {
  Card,
  CardHeader,
  CardFooter,
  CardTitle,
  CardAction,
  CardDescription,
  CardContent,
};

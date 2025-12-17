import { mergeProps } from "@base-ui/react/merge-props";
import { useRender } from "@base-ui/react/use-render";

function Card({ render, ...props }: useRender.ComponentProps<"div">) {
  return useRender({
    defaultTagName: "div",
    render,
    props: mergeProps<"div">(props, {
      className:
        "flex flex-col gap-2 rounded-xl border bg-card py-6 text-card-foreground shadow-sm",
    }),
    state: {
      slot: "card",
    },
  });
}

function CardHeader({ render, ...props }: useRender.ComponentProps<"div">) {
  return useRender({
    defaultTagName: "div",
    render,
    props: mergeProps<"div">(props, {
      className:
        "@container/card-header grid auto-rows-min grid-rows-[auto_auto] items-start gap-1.5 px-6 has-data-[slot=card-action]:grid-cols-[1fr_auto] [.border-b]:pb-6",
    }),
    state: {
      slot: "card-header",
    },
  });
}

function CardTitle({ render, ...props }: useRender.ComponentProps<"div">) {
  return useRender({
    defaultTagName: "div",
    render,
    props: mergeProps<"div">(props, {
      className: "font-semibold leading-none",
    }),
    state: {
      slot: "card-title",
    },
  });
}

function CardDescription({
  render,
  ...props
}: useRender.ComponentProps<"div">) {
  return useRender({
    defaultTagName: "div",
    render,
    props: mergeProps<"div">(props, {
      className: "text-muted-foreground text-sm",
    }),
    state: {
      slot: "card-description",
    },
  });
}

function CardAction({ render, ...props }: useRender.ComponentProps<"div">) {
  return useRender({
    defaultTagName: "div",
    render,
    props: mergeProps<"div">(props, {
      className:
        "col-start-2 row-span-2 row-start-1 self-start justify-self-end",
    }),
    state: {
      slot: "card-action",
    },
  });
}

function CardContent({ render, ...props }: useRender.ComponentProps<"div">) {
  return useRender({
    defaultTagName: "div",
    render,
    props: mergeProps<"div">(props, {
      className: "px-6",
    }),
    state: {
      slot: "card-content",
    },
  });
}

function CardFooter({ render, ...props }: useRender.ComponentProps<"div">) {
  return useRender({
    defaultTagName: "div",
    render,
    props: mergeProps<"div">(props, {
      className: "flex items-center px-6 [.border-t]:pt-6",
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

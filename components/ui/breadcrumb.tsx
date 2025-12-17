import { mergeProps } from "@base-ui/react/merge-props";
import { useRender } from "@base-ui/react/use-render";
import { ChevronRightIcon, MoreHorizontalIcon } from "lucide-react";
import { cn } from "@/lib/utils";

function Breadcrumb({
  className,
  render,
  ...props
}: useRender.ComponentProps<"nav">) {
  return useRender({
    defaultTagName: "nav",
    render,
    props: mergeProps<"nav">(props, {
      "aria-label": "breadcrumb",
      className,
    }),
    state: {
      slot: "breadcrumb",
    },
  });
}

function BreadcrumbList({
  className,
  render,
  ...props
}: useRender.ComponentProps<"ol">) {
  return useRender({
    defaultTagName: "ol",
    render,
    props: mergeProps<"ol">(props, {
      className: cn(
        "flex flex-wrap items-center gap-1.5 break-words text-muted-foreground text-sm",
        className,
      ),
    }),
    state: {
      slot: "breadcrumb-list",
    },
  });
}

function BreadcrumbItem({
  className,
  render,
  ...props
}: useRender.ComponentProps<"li">) {
  return useRender({
    defaultTagName: "li",
    render,
    props: mergeProps<"li">(props, {
      className: cn("inline-flex items-center gap-1", className),
    }),
    state: {
      slot: "breadcrumb-item",
    },
  });
}

function BreadcrumbLink({
  className,
  render,
  ...props
}: useRender.ComponentProps<"a">) {
  return useRender({
    defaultTagName: "a",
    props: mergeProps<"a">(props, {
      className: cn("hover:text-foreground transition-colors", className),
    }),
    render,
    state: {
      slot: "breadcrumb-link",
    },
  });
}

function BreadcrumbPage({
  className,
  render,
  ...props
}: useRender.ComponentProps<"span">) {
  return useRender({
    defaultTagName: "span",
    render,
    props: mergeProps<"span">(props, {
      "aria-current": "page",
      className: cn("font-normal text-foreground", className),
    }),
    state: {
      slot: "breadcrumb-page",
    },
  });
}

function BreadcrumbSeparator({
  children,
  className,
  render,
  ...props
}: useRender.ComponentProps<"li">) {
  return useRender({
    defaultTagName: "li",
    render,
    props: mergeProps<"li">(props, {
      role: "presentation",
      "aria-hidden": "true",
      className: cn("[&>svg]:size-3.5", className),
      children: children ?? <ChevronRightIcon />,
    }),
    state: {
      slot: "breadcrumb-separator",
    },
  });
}

function BreadcrumbEllipsis({
  className,
  render,
  ...props
}: useRender.ComponentProps<"span">) {
  return useRender({
    defaultTagName: "span",
    render,
    props: mergeProps<"span">(props, {
      className: cn(
        "flex size-5 items-center justify-center [&>svg]:size-4",
        className,
      ),
      children: <MoreHorizontalIcon aria-hidden={true} />,
    }),
    state: {
      slot: "breadcrumb-ellipsis",
    },
  });
}

export {
  Breadcrumb,
  BreadcrumbList,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbPage,
  BreadcrumbSeparator,
  BreadcrumbEllipsis,
};

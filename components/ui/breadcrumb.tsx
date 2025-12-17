import { mergeProps } from "@base-ui/react/merge-props";
import { useRender } from "@base-ui/react/use-render";
import { ChevronRightIcon, MoreHorizontalIcon } from "lucide-react";

function Breadcrumb({ render, ...props }: useRender.ComponentProps<"nav">) {
  return useRender({
    defaultTagName: "nav",
    render,
    props: mergeProps<"nav">(props, {
      "aria-label": "breadcrumb",
    }),
    state: {
      slot: "breadcrumb",
    },
  });
}

function BreadcrumbList({ render, ...props }: useRender.ComponentProps<"ol">) {
  return useRender({
    defaultTagName: "ol",
    render,
    props: mergeProps<"ol">(props, {
      className:
        "flex flex-wrap items-center gap-1.5 break-words text-muted-foreground text-sm",
    }),
    state: {
      slot: "breadcrumb-list",
    },
  });
}

function BreadcrumbItem({ render, ...props }: useRender.ComponentProps<"li">) {
  return useRender({
    defaultTagName: "li",
    render,
    props: mergeProps<"li">(props, {
      className: "inline-flex items-center gap-1",
    }),
    state: {
      slot: "breadcrumb-item",
    },
  });
}

function BreadcrumbLink({ render, ...props }: useRender.ComponentProps<"a">) {
  return useRender({
    defaultTagName: "a",
    props: mergeProps<"a">(props, {
      className: "hover:text-foreground transition-colors",
    }),
    render,
    state: {
      slot: "breadcrumb-link",
    },
  });
}

function BreadcrumbPage({
  render,
  ...props
}: useRender.ComponentProps<"span">) {
  return useRender({
    defaultTagName: "span",
    render,
    props: mergeProps<"span">(props, {
      role: "link",
      "aria-disabled": true,
      "aria-current": "page",
      className: "font-normal text-foreground",
    }),
    state: {
      slot: "breadcrumb-page",
    },
  });
}

function BreadcrumbSeparator({
  children,
  render,
  ...props
}: useRender.ComponentProps<"li">) {
  return useRender({
    defaultTagName: "li",
    render,
    props: mergeProps<"li">(props, {
      role: "presentation",
      "aria-hidden": "true",
      className: "[&>svg]:size-3.5",
      children: children ?? <ChevronRightIcon />,
    }),
    state: {
      slot: "breadcrumb-separator",
    },
  });
}

function BreadcrumbEllipsis({
  render,
  ...props
}: useRender.ComponentProps<"span">) {
  return useRender({
    defaultTagName: "span",
    render,
    props: mergeProps<"span">(props, {
      role: "presentation",
      "aria-hidden": "true",
      className: "flex size-5 items-center justify-center [&>svg]:size-4",
      children: (
        <>
          <MoreHorizontalIcon />
          <span className="sr-only">More</span>
        </>
      ),
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

"use client";

import { mergeProps } from "@base-ui/react/merge-props";
import { useRender } from "@base-ui/react/use-render";
import { cn } from "@/lib/utils";

function Table({
  className,
  render,
  ...props
}: useRender.ComponentProps<"table">) {
  const table = useRender({
    defaultTagName: "table",
    render,
    props: mergeProps<"table">(props, {
      className: cn("w-full caption-bottom text-sm", className),
    }),
    state: {
      slot: "table",
    },
  });

  return (
    <div
      data-slot="table-container"
      className="relative w-full overflow-x-auto"
    >
      {table}
    </div>
  );
}

function TableHeader({
  className,
  render,
  ...props
}: useRender.ComponentProps<"thead">) {
  return useRender({
    defaultTagName: "thead",
    render,
    props: mergeProps<"thead">(props, {
      className: cn("[&_tr]:border-b", className),
    }),
    state: {
      slot: "table-header",
    },
  });
}

function TableBody({
  className,
  render,
  ...props
}: useRender.ComponentProps<"tbody">) {
  return useRender({
    defaultTagName: "tbody",
    render,
    props: mergeProps<"tbody">(props, {
      className: cn("[&_tr:last-child]:border-0", className),
    }),
    state: {
      slot: "table-body",
    },
  });
}

function TableFooter({
  className,
  render,
  ...props
}: useRender.ComponentProps<"tfoot">) {
  return useRender({
    defaultTagName: "tfoot",
    render,
    props: mergeProps<"tfoot">(props, {
      className: cn(
        "border-t bg-muted/50 font-medium [&>tr]:last:border-b-0",
        className,
      ),
    }),
    state: {
      slot: "table-footer",
    },
  });
}

function TableRow({
  className,
  render,
  ...props
}: useRender.ComponentProps<"tr">) {
  return useRender({
    defaultTagName: "tr",
    render,
    props: mergeProps<"tr">(props, {
      className: cn(
        "border-b transition-colors hover:bg-muted/50 aria-selected:bg-muted",
        className,
      ),
    }),
    state: {
      slot: "table-row",
    },
  });
}

function TableHead({
  className,
  render,
  ...props
}: useRender.ComponentProps<"th">) {
  return useRender({
    defaultTagName: "th",
    render,
    props: mergeProps<"th">(props, {
      className: cn(
        "h-10 whitespace-nowrap px-2 text-left align-middle font-medium text-foreground [&:has([role=checkbox])]:pr-0",
        className,
      ),
    }),
    state: {
      slot: "table-head",
    },
  });
}

function TableCell({
  className,
  render,
  ...props
}: useRender.ComponentProps<"td">) {
  return useRender({
    defaultTagName: "td",
    render,
    props: mergeProps<"td">(props, {
      className: cn(
        "whitespace-nowrap p-2 align-middle [&:has([role=checkbox])]:pr-0",
        className,
      ),
    }),
    state: {
      slot: "table-cell",
    },
  });
}

function TableCaption({
  className,
  render,
  ...props
}: useRender.ComponentProps<"caption">) {
  return useRender({
    defaultTagName: "caption",
    render,
    props: mergeProps<"caption">(props, {
      className: cn("mt-4 text-muted-foreground text-sm", className),
    }),
    state: {
      slot: "table-caption",
    },
  });
}

export {
  Table,
  TableHeader,
  TableBody,
  TableFooter,
  TableHead,
  TableRow,
  TableCell,
  TableCaption,
};

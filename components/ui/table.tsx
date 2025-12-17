"use client";

import { mergeProps } from "@base-ui/react/merge-props";
import { useRender } from "@base-ui/react/use-render";

function Table({ render, ...props }: useRender.ComponentProps<"table">) {
  const table = useRender({
    defaultTagName: "table",
    render,
    props: mergeProps<"table">(props, {
      className: "w-full caption-bottom text-sm",
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

function TableHeader({ render, ...props }: useRender.ComponentProps<"thead">) {
  return useRender({
    defaultTagName: "thead",
    render,
    props: mergeProps<"thead">(props, {
      className: "[&_tr]:border-b",
    }),
    state: {
      slot: "table-header",
    },
  });
}

function TableBody({ render, ...props }: useRender.ComponentProps<"tbody">) {
  return useRender({
    defaultTagName: "tbody",
    render,
    props: mergeProps<"tbody">(props, {
      className: "[&_tr:last-child]:border-0",
    }),
    state: {
      slot: "table-body",
    },
  });
}

function TableFooter({ render, ...props }: useRender.ComponentProps<"tfoot">) {
  return useRender({
    defaultTagName: "tfoot",
    render,
    props: mergeProps<"tfoot">(props, {
      className: "border-t bg-muted/50 font-medium [&>tr]:last:border-b-0",
    }),
    state: {
      slot: "table-footer",
    },
  });
}

function TableRow({ render, ...props }: useRender.ComponentProps<"tr">) {
  return useRender({
    defaultTagName: "tr",
    render,
    props: mergeProps<"tr">(props, {
      className:
        "border-b transition-colors hover:bg-muted/50 data-[state=selected]:bg-muted",
    }),
    state: {
      slot: "table-row",
    },
  });
}

function TableHead({ render, ...props }: useRender.ComponentProps<"th">) {
  return useRender({
    defaultTagName: "th",
    render,
    props: mergeProps<"th">(props, {
      className:
        "h-10 whitespace-nowrap px-2 text-left align-middle font-medium text-foreground [&:has([role=checkbox])]:pr-0",
    }),
    state: {
      slot: "table-head",
    },
  });
}

function TableCell({ render, ...props }: useRender.ComponentProps<"td">) {
  return useRender({
    defaultTagName: "td",
    render,
    props: mergeProps<"td">(props, {
      className:
        "whitespace-nowrap p-2 align-middle [&:has([role=checkbox])]:pr-0",
    }),
    state: {
      slot: "table-cell",
    },
  });
}

function TableCaption({
  render,
  ...props
}: useRender.ComponentProps<"caption">) {
  return useRender({
    defaultTagName: "caption",
    render,
    props: mergeProps<"caption">(props, {
      className: "mt-4 text-muted-foreground text-sm",
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

"use client";

import { mergeProps } from "@base-ui/react/merge-props";
import { useRender } from "@base-ui/react/use-render";
import { cn, cva, type VariantProps } from "../utils";
import { Separator } from "./separator";

const buttonGroupVariants = cva({
  base: "flex w-fit items-stretch has-[>[data-slot=button-group]]:gap-2 [&>*]:focus-visible:relative [&>*]:focus-visible:z-10 has-[select[aria-hidden=true]:last-child]:[&>[data-slot=select-trigger]:last-of-type]:rounded-r-md [&>[data-slot=select-trigger]:not([class*='w-'])]:w-fit [&>input]:flex-1",
  variants: {
    orientation: {
      horizontal:
        "flex-row [&>[data-slot]:not(:has(~[data-slot]))]:rounded-r-md! [&>[data-slot]]:rounded-r-none [&>[data-slot]~[data-slot]]:rounded-l-none [&>[data-slot]~[data-slot]]:border-l-0",
      vertical:
        "flex-col [&>[data-slot]:not(:has(~[data-slot]))]:rounded-b-md! [&>[data-slot]]:rounded-b-none [&>[data-slot]~[data-slot]]:rounded-t-none [&>[data-slot]~[data-slot]]:border-t-0",
    },
  },
  defaultVariants: {
    orientation: "horizontal",
  },
});

function ButtonGroup({
  orientation,
  className,
  render,
  ...props
}: useRender.ComponentProps<"div"> & VariantProps<typeof buttonGroupVariants>) {
  return useRender({
    defaultTagName: "div",
    render,
    props: mergeProps<"div">(props, {
      role: "group",
      className: cn(buttonGroupVariants({ orientation }), className),
    }),
    state: {
      slot: "button-group",
      orientation,
    },
  });
}

function ButtonGroupText({
  className,
  render,
  ...props
}: useRender.ComponentProps<"div">) {
  return useRender({
    defaultTagName: "div",
    render,
    props: mergeProps<"div">(props, {
      className: cn(
        "flex items-center gap-2 rounded-md border bg-muted px-4 font-medium text-sm shadow-xs [&_svg:not([class*='size-'])]:size-4 [&_svg]:pointer-events-none",
        className,
      ),
    }),
    state: {
      slot: "button-group-text",
    },
  });
}

function ButtonGroupSeparator({
  className,
  orientation = "vertical",
  ...props
}: React.ComponentProps<typeof Separator>) {
  return (
    <Separator
      aria-hidden
      data-slot="button-group-separator"
      orientation={orientation}
      className={cn(
        "!m-0 relative self-stretch bg-input data-[orientation=vertical]:h-auto",
        className,
      )}
      {...props}
    />
  );
}

export {
  ButtonGroup,
  ButtonGroupSeparator,
  ButtonGroupText,
  buttonGroupVariants,
};

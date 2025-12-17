"use client";

import { mergeProps } from "@base-ui/react/merge-props";
import { useRender } from "@base-ui/react/use-render";

function Label({ render, ...props }: useRender.ComponentProps<"label">) {
  return useRender({
    defaultTagName: "label",
    render,
    props: mergeProps<"label">(props, {
      className:
        "flex select-none items-center gap-2 font-medium text-sm leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-50 group-data-[disabled=true]:pointer-events-none group-data-[disabled=true]:opacity-50",
    }),
    state: {
      slot: "label",
    },
  });
}

export { Label };

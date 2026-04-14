import { mergeProps } from "@base-ui/react/merge-props";
import { useRender } from "@base-ui/react/use-render";

import { cn } from "../utils";

function Label({ className, render, ...props }: useRender.ComponentProps<"label">) {
  return useRender({
    defaultTagName: "label",
    render,
    props: mergeProps<"label">(props, {
      className: cn(
        "flex items-center gap-2 text-sm leading-none font-medium select-none group-data-[disabled=true]:pointer-events-none group-data-[disabled=true]:opacity-50 peer-disabled:cursor-not-allowed peer-disabled:opacity-50",
        className,
      ),
    }),
    state: {
      slot: "label",
    },
  });
}

export { Label };

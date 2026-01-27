import { mergeProps } from "@base-ui/react/merge-props";
import { useRender } from "@base-ui/react/use-render";
import { cn } from "../utils";

function Label({
  className,
  render,
  ...props
}: useRender.ComponentProps<"label">) {
  return useRender({
    defaultTagName: "label",
    render,
    props: mergeProps<"label">(props, {
      className: cn(
        "flex select-none items-center gap-2 font-medium text-sm leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-50 group-data-[disabled=true]:pointer-events-none group-data-[disabled=true]:opacity-50",
        className,
      ),
    }),
    state: {
      slot: "label",
    },
  });
}

export { Label };

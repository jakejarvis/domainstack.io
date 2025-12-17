import { mergeProps } from "@base-ui/react/merge-props";
import { useRender } from "@base-ui/react/use-render";
import { cn } from "@/lib/utils";

function Skeleton({ className, render, ...props }: useRender.ComponentProps<"div">) {
  return useRender({
    defaultTagName: "div",
    render,
    props: mergeProps<"div">(props, {
      className: cn("animate-pulse rounded-md bg-accent", className),
    }),
    state: {
      slot: "skeleton",
    },
  });
}

export { Skeleton };

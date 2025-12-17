import { mergeProps } from "@base-ui/react/merge-props";
import { useRender } from "@base-ui/react/use-render";

function Skeleton({ render, ...props }: useRender.ComponentProps<"div">) {
  return useRender({
    defaultTagName: "div",
    render,
    props: mergeProps<"div">(props, {
      className: "animate-pulse rounded-md bg-accent",
    }),
    state: {
      slot: "skeleton",
    },
  });
}

export { Skeleton };

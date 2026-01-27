import { mergeProps } from "@base-ui/react/merge-props";
import { useRender } from "@base-ui/react/use-render";
import { cn } from "../utils";

function AspectRatio({
  ratio,
  className,
  render,
  ...props
}: useRender.ComponentProps<"div"> & { ratio: number }) {
  return useRender({
    defaultTagName: "div",
    render,
    props: mergeProps<"div">(props, {
      style: {
        "--ratio": ratio,
      } as React.CSSProperties,
      className: cn("relative aspect-[var(--ratio)]", className),
    }),
    state: {
      slot: "aspect-ratio",
    },
  });
}

export { AspectRatio };

import { mergeProps } from "@base-ui/react/merge-props";
import { useRender } from "@base-ui/react/use-render";

function AspectRatio({
  ratio,
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
      className: "relative aspect-(--ratio)",
    }),
    state: {
      slot: "aspect-ratio",
    },
  });
}

export { AspectRatio };

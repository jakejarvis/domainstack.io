import { mergeProps } from "@base-ui/react/merge-props";
import { useRender } from "@base-ui/react/use-render";
import { cn } from "../utils";

function Textarea({
  className,
  render,
  ...props
}: useRender.ComponentProps<"textarea">) {
  return useRender({
    defaultTagName: "textarea",
    render,
    props: mergeProps<"textarea">(props, {
      className: cn(
        "field-sizing-content flex min-h-16 w-full rounded-md border border-input bg-transparent px-3 py-2 text-base outline-none transition-colors md:text-sm",
        "placeholder:text-muted-foreground",
        "focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50",
        "aria-invalid:border-destructive aria-invalid:ring-[3px] aria-invalid:ring-destructive/20 dark:aria-invalid:border-destructive/50 dark:aria-invalid:ring-destructive/40",
        "disabled:cursor-not-allowed disabled:bg-input/50 disabled:opacity-50 dark:disabled:bg-input/80",
        "dark:bg-input/30",
        className,
      ),
    }),
    state: {
      slot: "textarea",
    },
  });
}

export { Textarea };

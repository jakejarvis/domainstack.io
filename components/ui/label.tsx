import { cn } from "@/lib/utils";

function Label({
  className,
  ...props
}: React.ComponentPropsWithoutRef<"label">) {
  return (
    // biome-ignore lint/a11y/noLabelWithoutControl: This is a generic Label primitive; association is provided via props (htmlFor) or nested controls at call sites.
    <label
      data-slot="label"
      className={cn(
        "flex select-none items-center gap-2 font-medium text-sm leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-50 group-data-[disabled=true]:pointer-events-none group-data-[disabled=true]:opacity-50",
        className,
      )}
      {...props}
    />
  );
}

export { Label };

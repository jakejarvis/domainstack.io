import { CircleNotchIcon } from "@phosphor-icons/react/ssr";
import { cn } from "@/lib/utils";

function Spinner({
  className,
  ...props
}: React.ComponentPropsWithoutRef<"svg">) {
  return (
    <CircleNotchIcon
      role="status"
      aria-label="Loading"
      className={cn("size-4 animate-spin", className)}
      {...props}
    />
  );
}

export { Spinner };

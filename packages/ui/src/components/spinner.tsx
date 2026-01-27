import { IconLoader2 } from "@tabler/icons-react";
import { cn } from "../utils";

function Spinner({
  className,
  ...props
}: React.ComponentPropsWithoutRef<"svg">) {
  return (
    <IconLoader2
      role="status"
      aria-label="Loading"
      className={cn("size-4 animate-spin", className)}
      {...props}
    />
  );
}

export { Spinner };

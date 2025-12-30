import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";

export function AppHeaderSeparator({ className }: { className?: string }) {
  return (
    <Separator
      aria-hidden="true"
      orientation="vertical"
      className={cn("!h-4", className)}
    />
  );
}

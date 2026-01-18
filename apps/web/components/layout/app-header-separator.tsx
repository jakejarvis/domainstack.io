import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";

export function AppHeaderSeparator({ className }: { className?: string }) {
  return <Separator orientation="vertical" className={cn("!h-4", className)} />;
}

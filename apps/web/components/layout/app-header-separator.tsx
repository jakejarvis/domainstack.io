import { Separator } from "@domainstack/ui/separator";
import { cn } from "@domainstack/ui/utils";

export function AppHeaderSeparator({ className }: { className?: string }) {
  return <Separator orientation="vertical" className={cn("!h-4", className)} />;
}

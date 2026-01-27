import { Badge } from "@domainstack/ui/badge";
import { cn } from "@/lib/utils";

export function BetaBadge({
  className,
  style,
  ...props
}: React.ComponentProps<typeof Badge>) {
  return (
    <Badge
      variant="secondary"
      className={cn(
        "relative inline-block select-none rounded-xl border-none py-1 text-white shadow-sm",
        className,
      )}
      style={{
        ...style,
        backgroundImage: [
          "radial-gradient(ellipse at 20% 30%, rgba(56, 189, 248, 0.4) 0%, transparent 60%)",
          "radial-gradient(ellipse at 80% 70%, rgba(139, 92, 246, 0.3) 0%, transparent 70%)",
          "radial-gradient(ellipse at 60% 20%, rgba(236, 72, 153, 0.25) 0%, transparent 50%)",
          "radial-gradient(ellipse at 40% 80%, rgba(34, 197, 94, 0.2) 0%, transparent 65%)",
        ].join(","),
      }}
      {...props}
    >
      Beta
    </Badge>
  );
}

import { Badge } from "@domainstack/ui/badge";
import { cn } from "@domainstack/ui/utils";

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
        backgroundColor: "rgba(15, 15, 20, 0.85)",
        backgroundImage: [
          "radial-gradient(ellipse at 20% 30%, rgba(56, 189, 248, 0.6) 0%, transparent 50%)",
          "radial-gradient(ellipse at 80% 70%, rgba(139, 92, 246, 0.5) 0%, transparent 55%)",
          "radial-gradient(ellipse at 60% 20%, rgba(236, 72, 153, 0.45) 0%, transparent 45%)",
          "radial-gradient(ellipse at 40% 80%, rgba(34, 197, 94, 0.4) 0%, transparent 50%)",
        ].join(","),
      }}
      {...props}
    >
      Beta
    </Badge>
  );
}

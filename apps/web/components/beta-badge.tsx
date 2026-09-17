import { Badge } from "@domainstack/ui/badge";
import { cn } from "@domainstack/ui/utils";

const BETA_MESH_GRADIENT = `
  radial-gradient(ellipse at 25% 30%, rgba(56, 189, 248, 0.8) 0%, transparent 50%),
  radial-gradient(ellipse at 75% 65%, rgba(139, 92, 246, 0.7) 0%, transparent 55%),
  radial-gradient(ellipse at 55% 20%, rgba(236, 72, 153, 0.6) 0%, transparent 45%),
  radial-gradient(ellipse at 40% 80%, rgba(34, 197, 94, 0.5) 0%, transparent 50%)
`;

export function BetaBadge({ className, style, ...props }: React.ComponentProps<typeof Badge>) {
  return (
    <Badge
      variant="secondary"
      className={cn(
        "relative isolate inline-flex overflow-hidden rounded-md border border-white/20 py-1 text-white/95 shadow-[0_1px_2px_rgba(2,6,23,0.28),inset_0_1px_0_rgba(255,255,255,0.18)] select-none",
        className,
      )}
      style={{
        backgroundColor: "rgb(15 15 20)",
        ...style,
      }}
      {...props}
    >
      <span
        aria-hidden="true"
        className="pointer-events-none absolute inset-[-25%] opacity-95 blur-[2px]"
        style={{ background: BETA_MESH_GRADIENT }}
      />
      <span className="relative z-10 drop-shadow-[0_1px_1px_rgba(0,0,0,0.35)]">Beta</span>
    </Badge>
  );
}

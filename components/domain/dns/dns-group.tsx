import { SubheadCount } from "@/components/domain/subhead-count";

type DnsGroupColor =
  | "blue"
  | "cyan"
  | "green"
  | "orange"
  | "purple"
  | "indigo"
  | "slate";

export function DnsGroup({
  title,
  children,
  color = "slate",
  count,
}: {
  title: string;
  children: React.ReactNode;
  color?: DnsGroupColor;
  count?: number;
}) {
  const actualCount = count ?? (Array.isArray(children) ? children.length : 1);
  if (actualCount === 0) return null;

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2 leading-none">
        <div className="text-[11px] text-foreground/70 uppercase tracking-[0.08em] dark:text-foreground/80">
          {title}
        </div>
        <SubheadCount count={actualCount} color={color} />
      </div>
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">{children}</div>
    </div>
  );
}

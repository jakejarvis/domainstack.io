import { Badge } from "@/components/badge";
import { Text } from "@/components/text";

type HealthStatus = "healthy" | "warning" | "critical" | "unknown";

type BadgeVariant = "default" | "success" | "warning" | "danger";

const CONFIG: Record<HealthStatus, { variant: BadgeVariant; label: string }> = {
  critical: { label: "Critical", variant: "danger" },
  healthy: { label: "Healthy", variant: "success" },
  unknown: { label: "Unknown", variant: "default" },
  warning: { label: "Needs attention", variant: "warning" },
};

function statusFor(
  expirationDate: Date | string | null | undefined,
  verified: boolean,
  now: number = Date.now(),
): HealthStatus {
  if (!verified || !expirationDate) return "unknown";
  const date = expirationDate instanceof Date ? expirationDate : new Date(expirationDate);
  if (Number.isNaN(date.getTime())) return "unknown";
  const days = Math.ceil((date.getTime() - now) / 86_400_000);
  if (days <= 7) return "critical";
  if (days <= 30) return "warning";
  return "healthy";
}

export function DomainHealthBadge({
  expirationDate,
  verified,
}: {
  expirationDate: Date | string | null | undefined;
  verified: boolean;
}) {
  const status = statusFor(expirationDate, verified);
  const config = CONFIG[status];
  return (
    <Badge variant={config.variant}>
      <Text>{config.label}</Text>
    </Badge>
  );
}

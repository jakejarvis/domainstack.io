import {
  IconAlertTriangle,
  IconProgressAlert,
  IconRosetteDiscountCheck,
  type TablerIcon,
} from "@tabler/icons-react";

import { BadgeWithTooltip } from "@/components/dashboard/badge-with-tooltip";
import { useHydratedNow } from "@/hooks/use-hydrated-now";
import { addDomainResumeHref } from "@/lib/add-domain-resume";
import { VERIFICATION_GRACE_PERIOD_DAYS } from "@domainstack/constants";
import type { TrackedDomainWithDetails, VerificationMethod } from "@domainstack/types";
import { cn } from "@domainstack/ui/utils";
import { calculateDaysElapsed } from "@domainstack/utils/expiry";

type DomainStatusBadgeProps = {
  domain: Pick<
    TrackedDomainWithDetails,
    "id" | "verified" | "verificationStatus" | "verificationMethod" | "verificationFailedAt"
  >;
  className?: string;
};

type DomainStatusBadgeConfig = {
  icon: TablerIcon;
  label: string;
  className: string;
  tooltipContent?: React.ReactNode;
  href?: string;
};

function getVerificationMethodLabel(method: VerificationMethod): string {
  if (method === "dns_txt") return "TXT record";
  if (method === "html_file") return "file";
  return "meta tag";
}

function getFailingTooltip(
  verificationFailedAt: Date | null | undefined,
  now: Date | null,
): string {
  const daysRemaining =
    verificationFailedAt && now
      ? Math.max(
          0,
          VERIFICATION_GRACE_PERIOD_DAYS - calculateDaysElapsed(verificationFailedAt, now),
        )
      : VERIFICATION_GRACE_PERIOD_DAYS;

  if (daysRemaining > 0) {
    return `${daysRemaining} ${daysRemaining === 1 ? "day" : "days"} to fix verification`;
  }
  return "Verification will be revoked soon";
}

function getDomainStatusBadge({
  domain: { id, verified, verificationStatus, verificationMethod, verificationFailedAt },
  className,
  now,
}: DomainStatusBadgeProps & { now: Date | null }): DomainStatusBadgeConfig {
  // Failing and Pending badges link to the verify flow; a healthy Verified badge doesn't.
  const verifyHref = addDomainResumeHref(id, verificationMethod);

  if (verified && verificationStatus === "failing") {
    return {
      icon: IconAlertTriangle,
      label: "Failing",
      className: cn("border-danger-border bg-danger/20 text-danger-foreground", className),
      tooltipContent: (
        <span suppressHydrationWarning>{getFailingTooltip(verificationFailedAt, now)}</span>
      ),
      href: verifyHref,
    };
  }

  if (verified) {
    return {
      icon: IconRosetteDiscountCheck,
      label: "Verified",
      className: cn("border-success-border bg-success/20 text-success-foreground", className),
      tooltipContent: verificationMethod
        ? `Using ${getVerificationMethodLabel(verificationMethod)}`
        : undefined,
    };
  }

  return {
    icon: IconProgressAlert,
    label: "Pending",
    className: cn("border-warning-border bg-warning/20 text-warning-foreground", className),
    tooltipContent: "Complete verification",
    href: verifyHref,
  };
}

export function DomainStatusBadge(props: DomainStatusBadgeProps) {
  const now = useHydratedNow();
  return <BadgeWithTooltip {...getDomainStatusBadge({ ...props, now })} />;
}

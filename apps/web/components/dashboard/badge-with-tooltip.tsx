import type { TablerIcon } from "@tabler/icons-react";
import Link from "next/link";

import { Badge } from "@domainstack/ui/badge";
import {
  ResponsiveTooltip,
  ResponsiveTooltipContent,
  ResponsiveTooltipTrigger,
} from "@domainstack/ui/responsive-tooltip";
import { cn } from "@domainstack/ui/utils";

type BadgeWithTooltipProps = {
  icon: TablerIcon;
  label: string;
  className?: string;
  tooltipContent?: React.ReactNode;
  /** Makes the badge a link (only when it also has tooltip content). */
  href?: string;
};

export function BadgeWithTooltip({
  icon: Icon,
  label,
  className,
  tooltipContent,
  href,
}: BadgeWithTooltipProps) {
  const badge = (
    <Badge
      className={cn(
        "gap-[5px] py-1 leading-none font-semibold select-none",
        href && "cursor-pointer transition-opacity hover:opacity-95",
        className,
      )}
    >
      <Icon className="size-3" />
      {label}
    </Badge>
  );

  if (!tooltipContent) {
    return badge;
  }

  const trigger = href ? (
    <Link href={href} scroll={false} className="cursor-pointer">
      {badge}
    </Link>
  ) : (
    badge
  );

  return (
    <ResponsiveTooltip>
      <ResponsiveTooltipTrigger nativeButton={false} render={trigger} />
      <ResponsiveTooltipContent>{tooltipContent}</ResponsiveTooltipContent>
    </ResponsiveTooltip>
  );
}

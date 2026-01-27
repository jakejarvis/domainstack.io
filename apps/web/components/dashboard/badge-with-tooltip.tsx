import { Badge } from "@domainstack/ui/badge";
import {
  ResponsiveTooltip,
  ResponsiveTooltipContent,
  ResponsiveTooltipTrigger,
} from "@domainstack/ui/responsive-tooltip";
import type { TablerIcon } from "@tabler/icons-react";
import { cn } from "@/lib/utils";

type BadgeWithTooltipProps = {
  icon: TablerIcon;
  label: string;
  className?: string;
  tooltipContent?: React.ReactNode;
  onClick?: () => void;
};

export function BadgeWithTooltip({
  icon: Icon,
  label,
  className,
  tooltipContent,
  onClick,
}: BadgeWithTooltipProps) {
  const badge = (
    <Badge
      className={cn(
        "select-none gap-[5px] py-1 font-semibold leading-none",
        onClick && "cursor-pointer transition-opacity hover:opacity-95",
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

  const trigger = onClick ? (
    <button type="button" onClick={onClick} className="cursor-pointer">
      {badge}
    </button>
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

"use client";

import { cva, type VariantProps } from "class-variance-authority";
import type { LucideIcon } from "lucide-react";
import { X } from "lucide-react";
import { type ReactNode, useState } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const bannerVariants = cva(
  "relative overflow-hidden rounded-xl border px-4 py-3",
  {
    variants: {
      variant: {
        info: "border-info-border bg-gradient-to-r from-info/50 to-info/30 dark:from-info/20 dark:to-info/10",
        warning:
          "border-warning-border bg-gradient-to-r from-warning/60 to-warning/40 dark:from-warning/25 dark:to-warning/15",
        success:
          "border-success-border bg-gradient-to-r from-success/50 to-success/30 dark:from-success/20 dark:to-success/10",
        danger:
          "border-danger-border bg-gradient-to-r from-danger/50 to-danger/30 dark:from-danger/20 dark:to-danger/10",
        pro: "border-accent-purple/20 bg-gradient-to-r from-accent-purple/10 to-accent-blue/10 dark:from-accent-purple/15 dark:to-accent-blue/15",
      },
    },
    defaultVariants: {
      variant: "info",
    },
  },
);

const iconVariants = cva(
  "flex size-8 shrink-0 items-center justify-center rounded-lg bg-white/50 dark:bg-black/20",
  {
    variants: {
      variant: {
        info: "text-info-foreground",
        warning: "text-warning-foreground",
        success: "text-success-foreground",
        danger: "text-danger-foreground",
        pro: "text-accent-purple",
      },
    },
    defaultVariants: {
      variant: "info",
    },
  },
);

const titleVariants = cva("font-medium text-sm", {
  variants: {
    variant: {
      info: "text-info-foreground",
      warning: "text-warning-foreground",
      success: "text-success-foreground",
      danger: "text-danger-foreground",
      pro: "text-accent-purple",
    },
  },
  defaultVariants: {
    variant: "info",
  },
});

const buttonVariants = cva("", {
  variants: {
    variant: {
      info: "bg-info-foreground text-white hover:bg-info-foreground/90 dark:text-info",
      warning:
        "bg-warning-foreground text-white hover:bg-warning-foreground/90 dark:text-warning",
      success:
        "bg-success-foreground text-white hover:bg-success-foreground/90 dark:text-success",
      danger:
        "bg-danger-foreground text-white hover:bg-danger-foreground/90 dark:text-danger",
      pro: "bg-accent-purple text-white hover:bg-accent-purple/90",
    },
  },
  defaultVariants: {
    variant: "info",
  },
});

type DashboardBannerProps = VariantProps<typeof bannerVariants> & {
  icon?: LucideIcon;
  title: string;
  description?: ReactNode;
  /** Optional action button */
  action?: {
    label: string;
    onClick: () => void;
    loading?: boolean;
  };
  /** Secondary action (e.g., "Learn more") */
  secondaryAction?: {
    label: string;
    onClick: () => void;
  };
  /** Allow dismissing the banner */
  dismissible?: boolean;
  /** Callback when dismissed */
  onDismiss?: () => void;
  className?: string;
};

export function DashboardBanner({
  variant,
  icon: Icon,
  title,
  description,
  action,
  secondaryAction,
  dismissible = false,
  onDismiss,
  className,
}: DashboardBannerProps) {
  const [isDismissed, setIsDismissed] = useState(false);

  if (isDismissed) return null;

  const handleDismiss = () => {
    setIsDismissed(true);
    onDismiss?.();
  };

  return (
    <div className={cn(bannerVariants({ variant }), className)}>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        {/* Content */}
        <div className="flex items-start gap-3 sm:items-center">
          {Icon && (
            <div className={iconVariants({ variant })}>
              <Icon className="size-4" />
            </div>
          )}
          <div className="min-w-0 flex-1">
            <p className={titleVariants({ variant })}>{title}</p>
            {description && (
              <p className="mt-0.5 text-muted-foreground text-sm">
                {description}
              </p>
            )}
          </div>
        </div>

        {/* Actions */}
        <div className="flex shrink-0 items-center gap-2 pl-11 sm:pl-0">
          {secondaryAction && (
            <Button
              variant="ghost"
              size="sm"
              onClick={secondaryAction.onClick}
              className="text-muted-foreground hover:text-foreground"
            >
              {secondaryAction.label}
            </Button>
          )}
          {action && (
            <Button
              size="sm"
              onClick={action.onClick}
              disabled={action.loading}
              className={buttonVariants({ variant })}
            >
              {action.loading ? "Loading..." : action.label}
            </Button>
          )}
        </div>
      </div>

      {/* Dismiss button */}
      {dismissible && (
        <button
          type="button"
          onClick={handleDismiss}
          className="absolute top-2 right-2 rounded-md p-1 text-muted-foreground/70 transition-colors hover:bg-black/5 hover:text-muted-foreground dark:hover:bg-white/10"
          aria-label="Dismiss"
        >
          <X className="size-4" />
        </button>
      )}
    </div>
  );
}

export { bannerVariants };

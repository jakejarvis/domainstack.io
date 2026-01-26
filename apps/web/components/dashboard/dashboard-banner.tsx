import { IconX, type TablerIcon } from "@tabler/icons-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Spinner } from "@/components/ui/spinner";
import { cn } from "@/lib/utils";

type DashboardBannerProps = {
  icon?: TablerIcon;
  title: string;
  description?: React.ReactNode;
  variant: "info" | "warning" | "success" | "danger";
  /** Optional action button - can be a React node for full control */
  action?:
    | {
        label: string;
        onClick: () => void;
        loading?: boolean;
        disabled?: boolean;
      }
    | React.ReactNode;
  /** Secondary action (e.g., "Learn more") - can be a React node for full control */
  secondaryAction?:
    | {
        label: string;
        onClick: () => void;
        loading?: boolean;
        disabled?: boolean;
      }
    | React.ReactNode;
  /** Allow dismissing the banner */
  dismissible?: boolean;
  /** Callback when dismissed */
  onDismiss?: () => void;
  className?: string;
};

export function DashboardBanner({
  variant = "info",
  icon: Icon,
  title,
  description,
  action,
  secondaryAction,
  dismissible = false,
  onDismiss,
  className,
}: DashboardBannerProps) {
  const handleDismiss = () => {
    onDismiss?.();
  };

  const handleActionClick = () => {
    if (action && typeof action === "object" && "onClick" in action) {
      action.onClick();
    }
  };

  const handleSecondaryActionClick = () => {
    if (
      secondaryAction &&
      typeof secondaryAction === "object" &&
      "onClick" in secondaryAction
    ) {
      secondaryAction.onClick();
    }
  };

  // Check if actions are custom React nodes or button configs
  const isCustomAction =
    action && typeof action === "object" && !("onClick" in action);
  const isButtonAction =
    action && typeof action === "object" && "onClick" in action;
  const isCustomSecondaryAction =
    secondaryAction &&
    typeof secondaryAction === "object" &&
    !("onClick" in secondaryAction);
  const isButtonSecondaryAction =
    secondaryAction &&
    typeof secondaryAction === "object" &&
    "onClick" in secondaryAction;

  // Map variant to glow colors (using vibrant accent colors with soft opacity)
  const glowColors = {
    info: { primary: "bg-accent-blue/10", secondary: "bg-accent-blue/8" },
    warning: {
      primary: "bg-accent-orange/10",
      secondary: "bg-accent-orange/8",
    },
    success: {
      primary: "bg-accent-green/10",
      secondary: "bg-accent-green/8",
    },
    danger: { primary: "bg-accent-red/10", secondary: "bg-accent-red/8" },
  };

  return (
    <Card
      className={cn(
        "group/dashboard-banner relative overflow-hidden border-black/10 bg-muted/10 dark:border-white/10",
        className,
      )}
    >
      {/* Dismiss button */}
      {dismissible && (
        <Button
          variant="ghost"
          size="icon"
          onClick={handleDismiss}
          className="absolute top-2 right-2 z-10 size-6 text-muted-foreground hover:text-foreground group-hover/dashboard-banner:visible sm:invisible"
          aria-label="Dismiss"
        >
          <IconX />
          <span className="sr-only">Dismiss</span>
        </Button>
      )}

      {/* Decorative accent glows */}
      <div
        aria-hidden
        className={cn(
          "pointer-events-none absolute -top-24 -right-20 size-48 rounded-full blur-[80px]",
          glowColors[variant].primary,
        )}
      />
      <div
        aria-hidden
        className={cn(
          "pointer-events-none absolute -bottom-20 left-8 size-40 rounded-full blur-[80px]",
          glowColors[variant].secondary,
        )}
      />

      <CardHeader className="relative flex flex-col items-start justify-between gap-4 space-y-0 md:flex-row md:items-center">
        <div className="flex-1 space-y-1.5">
          <div className="flex items-start gap-5 md:items-center">
            {Icon && (
              <div
                className={cn(
                  "flex size-11 shrink-0 items-center justify-center rounded-xl",
                  variant === "info" && "bg-accent-blue/5 text-info-foreground",
                  variant === "warning" &&
                    "bg-accent-orange/5 text-warning-foreground",
                  variant === "success" &&
                    "bg-accent-green/5 text-success-foreground",
                  variant === "danger" &&
                    "bg-accent-red/5 text-danger-foreground",
                )}
              >
                <Icon className="size-5" />
              </div>
            )}
            <div className="space-y-1">
              <CardTitle className="text-lg">{title}</CardTitle>
              {description && <CardDescription>{description}</CardDescription>}
            </div>
          </div>
        </div>
        <div className="flex w-full shrink-0 items-center gap-2 md:mr-3 md:w-auto">
          {isCustomSecondaryAction && secondaryAction}
          {isButtonSecondaryAction && (
            <Button
              variant="outline"
              onClick={handleSecondaryActionClick}
              disabled={secondaryAction.loading || secondaryAction.disabled}
              className="text-muted-foreground hover:text-foreground"
            >
              {secondaryAction.loading && <Spinner />}
              {secondaryAction.label}
            </Button>
          )}
          {isCustomAction && action}
          {isButtonAction && (
            <Button
              onClick={handleActionClick}
              disabled={action.loading || action.disabled}
            >
              {action.loading && <Spinner />}
              {action.label}
            </Button>
          )}
        </div>
      </CardHeader>
    </Card>
  );
}

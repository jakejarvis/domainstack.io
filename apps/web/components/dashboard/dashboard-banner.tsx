import { IconX, type TablerIcon } from "@tabler/icons-react";

import { Button } from "@domainstack/ui/button";
import { Card, CardDescription, CardHeader, CardTitle } from "@domainstack/ui/card";
import { Spinner } from "@domainstack/ui/spinner";
import { cn } from "@domainstack/ui/utils";

const SURFACE_COLORS = {
  info: "border-accent-blue/20 bg-accent-blue/4",
  warning: "border-accent-orange/20 bg-accent-orange/4",
  success: "border-accent-green/20 bg-accent-green/4",
  danger: "border-accent-red/20 bg-accent-red/4",
};

const ICON_COLORS = {
  info: "bg-accent-blue/10 text-info-foreground ring-accent-blue/15",
  warning: "bg-accent-orange/10 text-warning-foreground ring-accent-orange/15",
  success: "bg-accent-green/10 text-success-foreground ring-accent-green/15",
  danger: "bg-accent-red/10 text-danger-foreground ring-accent-red/15",
};

type BannerButtonConfig = {
  label: string;
  onClick: () => void;
  loading?: boolean;
  disabled?: boolean;
};

type DashboardBannerProps = {
  icon?: TablerIcon;
  title: string;
  description?: React.ReactNode;
  variant: "info" | "warning" | "success" | "danger";
  /** Optional action button - can be a React node for full control */
  action?: BannerButtonConfig | React.ReactNode;
  /** Secondary action (e.g., "Learn more") - can be a React node for full control */
  secondaryAction?: BannerButtonConfig | React.ReactNode;
  /** Allow dismissing the banner */
  dismissible?: boolean;
  /** Callback when dismissed */
  onDismiss?: () => void;
  className?: string;
};

function isBannerButtonConfig(action: unknown): action is BannerButtonConfig {
  return Boolean(action && typeof action === "object" && "onClick" in action);
}

function BannerActionButton({
  action,
  variant = "default",
}: {
  action: BannerButtonConfig | React.ReactNode | undefined;
  variant?: "default" | "outline";
}) {
  if (isBannerButtonConfig(action)) {
    return (
      <Button
        variant={variant}
        onClick={action.onClick}
        disabled={action.loading || action.disabled}
        className={
          variant === "outline" ? "text-muted-foreground hover:text-foreground" : undefined
        }
      >
        {action.loading ? <Spinner /> : null}
        {action.label}
      </Button>
    );
  }

  return action;
}

function DashboardBannerActions({
  action,
  secondaryAction,
}: {
  action: DashboardBannerProps["action"];
  secondaryAction: DashboardBannerProps["secondaryAction"];
}) {
  return (
    <div className="flex w-full shrink-0 items-center gap-2 md:mr-3 md:w-auto">
      <BannerActionButton action={secondaryAction} variant="outline" />
      <BannerActionButton action={action} />
    </div>
  );
}

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
  return (
    <Card className={cn("group/dashboard-banner relative", SURFACE_COLORS[variant], className)}>
      {dismissible ? (
        <Button
          variant="ghost"
          size="icon"
          onClick={() => onDismiss?.()}
          className="absolute top-2 right-2 z-10 size-6 text-muted-foreground group-hover/dashboard-banner:visible hover:text-foreground sm:invisible"
          aria-label="Dismiss"
        >
          <IconX />
          <span className="sr-only">Dismiss</span>
        </Button>
      ) : null}

      <CardHeader className="flex flex-col items-start justify-between gap-4 space-y-0 md:flex-row md:items-center">
        <div className="flex-1 space-y-1.5">
          <div className="flex items-start gap-5 md:items-center">
            {Icon ? (
              <div
                className={cn(
                  "flex size-11 shrink-0 items-center justify-center rounded-xl ring-1 ring-inset",
                  ICON_COLORS[variant],
                )}
              >
                <Icon className="size-5" />
              </div>
            ) : null}
            <div className="space-y-1">
              <CardTitle className="text-lg">{title}</CardTitle>
              {description ? <CardDescription>{description}</CardDescription> : null}
            </div>
          </div>
        </div>
        <DashboardBannerActions action={action} secondaryAction={secondaryAction} />
      </CardHeader>
    </Card>
  );
}

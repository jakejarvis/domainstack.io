import { IconX, type TablerIcon } from "@tabler/icons-react";

import { Button } from "@domainstack/ui/button";
import { Card, CardDescription, CardHeader, CardTitle } from "@domainstack/ui/card";
import { Spinner } from "@domainstack/ui/spinner";
import { cn } from "@domainstack/ui/utils";

const GLOW_COLORS = {
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

const ICON_COLORS = {
  info: "bg-accent-blue/5 text-info-foreground",
  warning: "bg-accent-orange/5 text-warning-foreground",
  success: "bg-accent-green/5 text-success-foreground",
  danger: "bg-accent-red/5 text-danger-foreground",
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
    <Card
      className={cn(
        "group/dashboard-banner relative overflow-hidden border-black/10 bg-muted/10 dark:border-white/10",
        className,
      )}
    >
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

      <div
        aria-hidden
        className={cn(
          "pointer-events-none absolute -top-24 -right-20 size-48 rounded-full blur-[80px]",
          GLOW_COLORS[variant].primary,
        )}
      />
      <div
        aria-hidden
        className={cn(
          "pointer-events-none absolute -bottom-20 left-8 size-40 rounded-full blur-[80px]",
          GLOW_COLORS[variant].secondary,
        )}
      />

      <CardHeader className="relative flex flex-col items-start justify-between gap-4 space-y-0 md:flex-row md:items-center">
        <div className="flex-1 space-y-1.5">
          <div className="flex items-start gap-5 md:items-center">
            {Icon ? (
              <div
                className={cn(
                  "flex size-11 shrink-0 items-center justify-center rounded-xl",
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

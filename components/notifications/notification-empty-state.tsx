import { PartyPopper } from "lucide-react";

interface NotificationEmptyStateProps {
  variant: "inbox" | "archive";
}

export function NotificationEmptyState({
  variant,
}: NotificationEmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center p-12 text-center">
      <div className="mb-3 flex size-12 items-center justify-center rounded-full bg-accent/50 dark:bg-accent/30">
        <PartyPopper className="size-[22px] text-foreground/50 dark:text-foreground/70" />
      </div>
      <p className="text-foreground/80 text-sm">All caught up!</p>
      <p className="mt-1 text-[13px] text-muted-foreground/80">
        No {variant === "inbox" ? "unread" : "archived"} notifications
      </p>
    </div>
  );
}

import { formatDistanceToNow } from "date-fns";
import Link from "next/link";
import { cn } from "@/lib/utils";
import {
  getNotificationIcon,
  getNotificationSeverity,
  getSeverityColors,
  getUnreadIndicatorColor,
} from "./notification-utils";

export interface NotificationData {
  id: string;
  type: string;
  title: string;
  message: string;
  sentAt: Date;
  readAt: Date | null;
}

interface NotificationCardProps {
  notification: NotificationData;
  onClick?: () => void;
  href?: string;
}

export function NotificationCard({
  notification,
  onClick,
  href = "/dashboard",
}: NotificationCardProps) {
  const Icon = getNotificationIcon(notification.type);
  const severity = getNotificationSeverity(notification.type);
  const colors = getSeverityColors(severity, !!notification.readAt);
  const isUnread = !notification.readAt;

  return (
    <Link
      href={href}
      data-notification-id={notification.id}
      onClick={onClick}
      className={cn(
        "block w-full p-3 transition-colors hover:bg-muted/40",
        isUnread && "bg-accent/20 hover:bg-accent/25",
      )}
    >
      <div className="flex gap-3">
        {/* Icon */}
        <div
          className={cn(
            "flex size-8 shrink-0 items-center justify-center rounded-lg",
            colors.bg,
            colors.text,
          )}
        >
          <Icon className="size-4" />
        </div>

        {/* Content */}
        <div className="min-w-0 flex-1 space-y-1">
          <div className="flex items-start justify-between gap-2">
            <p className="font-medium text-sm leading-tight">
              {notification.title}
            </p>
            {isUnread && (
              <span
                className={cn(
                  "mt-0.5 size-2 shrink-0 rounded-full",
                  getUnreadIndicatorColor(severity),
                )}
                role="status"
                aria-label="Unread"
              />
            )}
          </div>
          <p className="line-clamp-2 text-[13px] text-muted-foreground leading-relaxed">
            {notification.message}
          </p>
          <p className="text-muted-foreground/75 text-xs">
            {formatDistanceToNow(notification.sentAt, {
              addSuffix: true,
            })}
          </p>
        </div>
      </div>
    </Link>
  );
}

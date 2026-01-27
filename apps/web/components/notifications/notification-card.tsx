import { Icon } from "@domainstack/ui/icon";
import { formatDistanceToNow } from "date-fns";
import Link from "next/link";
import {
  getNotificationIcon,
  getNotificationSeverity,
  getSeverityIconColor,
  getUnreadIndicatorColor,
} from "@/lib/notification-utils";
import type { NotificationData } from "@/lib/types/notifications";
import { cn } from "@/lib/utils";

interface NotificationCardProps {
  notification: NotificationData;
  onClick?: () => void;
}

export function NotificationCard({
  notification,
  onClick,
}: NotificationCardProps) {
  const IconComponent = getNotificationIcon(notification.type);
  const severity = getNotificationSeverity(notification.type);
  const iconColor = getSeverityIconColor(severity, !!notification.readAt);
  const isUnread = !notification.readAt;

  // Build href with domainId filter when notification is domain-specific
  const href = notification.trackedDomainId
    ? `/dashboard?domainId=${notification.trackedDomainId}`
    : "/dashboard";

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
        <Icon size="sm" variant={iconColor} className="rounded-full">
          <IconComponent />
        </Icon>

        {/* Content */}
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <p className="font-medium text-sm">{notification.title}</p>
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
          <p className="line-clamp-3 text-[13px] text-muted-foreground">
            {notification.message}
          </p>
          <p className="mt-1 text-muted-foreground/75 text-xs">
            {formatDistanceToNow(notification.sentAt, {
              addSuffix: true,
            })}
          </p>
        </div>
      </div>
    </Link>
  );
}

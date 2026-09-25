import { IconArchive, IconArrowRight, IconConfetti } from "@tabler/icons-react";
import Link from "next/link";

import { Button } from "@domainstack/ui/button";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@domainstack/ui/empty";

interface NotificationEmptyStateProps {
  variant: "inbox" | "archive";
  onClosePopover?: () => void;
}

export function NotificationEmptyState({ variant, onClosePopover }: NotificationEmptyStateProps) {
  return (
    <Empty className="p-10 md:p-10">
      <EmptyHeader>
        <EmptyMedia variant="icon">
          {variant === "inbox" ? <IconConfetti /> : <IconArchive />}
        </EmptyMedia>
        <EmptyTitle>{variant === "inbox" ? "All caught up!" : "Nothing archived yet"}</EmptyTitle>
        <EmptyDescription>
          {variant === "inbox" ? "No unread notifications" : "Nothing to see here (yet…)"}
        </EmptyDescription>
      </EmptyHeader>
      <EmptyContent>
        <Button
          variant="link"
          className="text-[13px]"
          nativeButton={false}
          aria-label="Go to dashboard"
          render={
            // onNavigate fires only for client-side navigation, so a modified click
            // still opens a new tab and leaves the popover open.
            <Link href="/dashboard" onNavigate={onClosePopover}>
              Go to dashboard
              <IconArrowRight className="size-3" />
            </Link>
          }
        />
      </EmptyContent>
    </Empty>
  );
}

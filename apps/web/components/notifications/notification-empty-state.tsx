import { IconArchive, IconArrowRight, IconConfetti } from "@tabler/icons-react";
import Link from "next/link";

import { useRouter } from "@/hooks/use-router";
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
  const router = useRouter();

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
          onClick={(e) => {
            e.preventDefault();
            router.push("/dashboard");
            onClosePopover?.();
          }}
          nativeButton={false}
          aria-label="Go to dashboard"
          render={
            <Link href="/dashboard">
              Go to dashboard
              <IconArrowRight className="size-3" />
            </Link>
          }
        />
      </EmptyContent>
    </Empty>
  );
}

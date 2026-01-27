import { Button } from "@domainstack/ui/button";
import { Icon } from "@domainstack/ui/icon";
import { IconArchive, IconArrowRight, IconConfetti } from "@tabler/icons-react";
import Link from "next/link";
import { useRouter } from "@/hooks/use-router";

interface NotificationEmptyStateProps {
  variant: "inbox" | "archive";
  onClosePopover?: () => void;
}

export function NotificationEmptyState({
  variant,
  onClosePopover,
}: NotificationEmptyStateProps) {
  const router = useRouter();

  return (
    <div className="flex flex-col items-center justify-center p-10 text-center">
      <Icon className="mb-4">
        {variant === "inbox" ? <IconConfetti /> : <IconArchive />}
      </Icon>
      <p className="text-foreground/80 text-sm">All caught up!</p>
      <p className="mt-1 text-[13px] text-muted-foreground/80">
        {variant === "inbox"
          ? "No unread notifications"
          : "Nothing to see here (yet…)"}
      </p>
      <Button
        variant="link"
        className="mt-5 text-[13px]"
        onClick={(e) => {
          e.preventDefault();
          router.push("/dashboard");
          onClosePopover?.();
        }}
        nativeButton={false}
        render={
          <Link href="/dashboard">
            Go to dashboard
            <IconArrowRight className="size-3" />
          </Link>
        }
      />
    </div>
  );
}

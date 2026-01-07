import { ArrowRight, PartyPopper } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
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
      <div className="mb-3 flex size-12 items-center justify-center rounded-full bg-accent/50 dark:bg-accent/30">
        <PartyPopper className="size-[22px] text-foreground/50 dark:text-foreground/70" />
      </div>
      <p className="text-foreground/80 text-sm">All caught up!</p>
      <p className="mt-1 text-[13px] text-muted-foreground/80">
        No {variant === "inbox" ? "unread" : "archived"} notifications
      </p>
      <Button
        variant="outline"
        className="mt-5 text-[13px]"
        onClick={(e) => {
          e.preventDefault();
          router.push("/dashboard");
          onClosePopover?.();
        }}
        nativeButton={false}
        render={
          <Link href="/dashboard">
            Dashboard
            <ArrowRight className="size-3" />
          </Link>
        }
      />
    </div>
  );
}

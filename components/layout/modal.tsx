"use client";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useRouter } from "@/hooks/use-router";
import { cn } from "@/lib/utils";

interface ModalProps {
  children: React.ReactNode;
  className?: string;
  title?: string;
  description?: string;
  showHeader?: boolean;
}

export function Modal({
  children,
  className,
  title = "Modal",
  description = "Modal content",
  showHeader = false,
}: ModalProps) {
  const router = useRouter();

  return (
    <Dialog open={true} onOpenChange={() => router.back()}>
      <DialogContent
        className={cn(
          "flex max-h-[85vh] flex-col gap-0 overflow-hidden p-0",
          className,
        )}
      >
        <DialogHeader
          className={cn(
            showHeader ? "border-muted border-b px-6 pt-6 pb-4" : "sr-only",
          )}
        >
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <ScrollArea className="min-h-0 flex-1" gradient>
          <div className="py-6">{children}</div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}

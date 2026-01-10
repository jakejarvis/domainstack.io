"use client";

import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
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
  headerSlotId?: string;
  headerSlotClassName?: string;
  /**
   * Path prefix for inter-modal navigation. If provided, the modal will stay
   * open when navigating to paths that start with this prefix (e.g., switching
   * between settings tabs). Navigating outside this prefix will close the modal.
   */
  allowedPathPrefix?: string;
}

export function Modal({
  children,
  className,
  title = "Modal",
  description = "Modal content",
  showHeader = false,
  headerSlotId,
  headerSlotClassName,
  allowedPathPrefix,
}: ModalProps) {
  const router = useRouter();
  const pathname = usePathname();
  const initialPathnameRef = useRef(pathname);
  const [isOpen, setIsOpen] = useState(true);

  // Close modal when navigating away (e.g., clicking a link inside the modal)
  // If allowedPathPrefix is set, only close when navigating outside that prefix
  useEffect(() => {
    if (pathname === initialPathnameRef.current) return;

    if (allowedPathPrefix && pathname.startsWith(allowedPathPrefix)) {
      // Navigating within allowed prefix (e.g., settings tabs) - stay open
      return;
    }

    setIsOpen(false);
  }, [pathname, allowedPathPrefix]);

  return (
    <Dialog open={isOpen} onOpenChange={() => router.back()}>
      <DialogContent
        className={cn(
          "mx-auto flex max-h-[85vh] w-full max-w-[calc(100%-2rem)] flex-col gap-0 overflow-hidden p-0 sm:max-w-xl",
          className,
        )}
      >
        <DialogHeader
          className={cn(showHeader ? "border-muted border-b p-5" : "sr-only")}
        >
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
          {showHeader && headerSlotId ? (
            <div
              id={headerSlotId}
              className={cn("min-h-[1px]", headerSlotClassName)}
            />
          ) : null}
        </DialogHeader>
        <ScrollArea className="min-h-0 max-w-full flex-1 overflow-y-hidden">
          {children}
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}

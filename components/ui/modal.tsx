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
}

export function Modal({
  children,
  className,
  title = "Modal",
  description = "Modal content",
  showHeader = false,
  headerSlotId,
  headerSlotClassName,
}: ModalProps) {
  const router = useRouter();
  const pathname = usePathname();
  const initialPathnameRef = useRef(pathname);
  const [isOpen, setIsOpen] = useState(true);

  // Close modal when pathname changes (e.g., clicking a link inside the modal)
  useEffect(() => {
    if (pathname !== initialPathnameRef.current) {
      setIsOpen(false);
    }
  }, [pathname]);

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

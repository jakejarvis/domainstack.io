"use client";

import { Dialog as DialogPrimitive } from "@base-ui/react/dialog";
import { XIcon } from "@phosphor-icons/react/ssr";
import { Button } from "@/components/ui/button";
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

  return (
    <DialogPrimitive.Root open onOpenChange={() => router.back()}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Backdrop
          className={cn(
            "fixed inset-0 isolate bg-black/10 backdrop-blur-xs dark:bg-black/50",
            "data-open:fade-in-0 data-open:animate-in data-open:duration-200",
            "data-closed:fade-out-0 data-closed:animate-out data-closed:duration-200",
            "supports-[-webkit-touch-callout:none]:absolute",
          )}
        />
        <DialogPrimitive.Viewport className="fixed inset-0 flex items-center justify-center overflow-hidden py-12">
          <DialogPrimitive.Popup
            className={cn(
              "relative flex max-h-[85vh] min-h-0 w-full max-w-[calc(100%-2rem)] flex-col gap-0 overflow-hidden p-0 sm:max-w-xl",
              "rounded-lg border border-border/60 bg-background/95 text-foreground shadow-lg outline-hidden backdrop-blur-xl dark:bg-background/80",
              "data-open:fade-in-0 data-open:zoom-in-95 data-open:animate-in data-open:duration-200",
              "data-closed:fade-out-0 data-closed:zoom-out-95 data-closed:animate-out data-closed:duration-200",
              className,
            )}
          >
            <div
              className={cn(
                showHeader
                  ? "flex flex-col gap-2 border-muted border-b p-5"
                  : "sr-only",
              )}
            >
              <DialogPrimitive.Title className="font-semibold text-lg leading-none">
                {title}
              </DialogPrimitive.Title>
              <DialogPrimitive.Description className="text-muted-foreground text-sm">
                {description}
              </DialogPrimitive.Description>
              {showHeader && headerSlotId ? (
                <div
                  id={headerSlotId}
                  className={cn("min-h-[1px]", headerSlotClassName)}
                />
              ) : null}
            </div>
            <ScrollArea className="min-h-0 max-w-full flex-1 overflow-y-hidden">
              {children}
            </ScrollArea>
            <DialogPrimitive.Close
              className="absolute top-2 right-2"
              render={
                <Button variant="ghost" size="icon-sm">
                  <XIcon className="size-4" />
                  <span className="sr-only">Close</span>
                </Button>
              }
            />
          </DialogPrimitive.Popup>
        </DialogPrimitive.Viewport>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}

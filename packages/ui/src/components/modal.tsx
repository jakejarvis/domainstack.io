"use client";

import { Dialog as DialogPrimitive } from "@base-ui/react/dialog";
import { IconX } from "@tabler/icons-react";
import { cn } from "../utils";
import { Button } from "./button";

function Modal({ ...props }: DialogPrimitive.Root.Props) {
  return <DialogPrimitive.Root data-slot="modal" {...props} />;
}

function ModalPortal({ ...props }: DialogPrimitive.Portal.Props) {
  return <DialogPrimitive.Portal data-slot="modal-portal" {...props} />;
}

function ModalClose({ ...props }: DialogPrimitive.Close.Props) {
  return (
    <DialogPrimitive.Close
      data-slot="modal-close"
      render={
        <Button variant="ghost" size="icon-xs" className="rounded">
          <IconX className="size-4" />
          <span className="sr-only">Close</span>
        </Button>
      }
      {...props}
    />
  );
}

function ModalOverlay({ className, ...props }: DialogPrimitive.Backdrop.Props) {
  return (
    <DialogPrimitive.Backdrop
      data-slot="modal-overlay"
      className={cn(
        "fixed inset-0 isolate bg-black/10 backdrop-blur-xs dark:bg-black/50",
        "data-open:fade-in-0 data-open:animate-in data-open:duration-200",
        "data-closed:fade-out-0 data-closed:animate-out data-closed:duration-200",
        // iOS 26+: ensure backdrops cover the visual viewport
        "supports-[-webkit-touch-callout:none]:absolute",
        className,
      )}
      {...props}
    />
  );
}

function ModalContent({
  children,
  className,
  showCloseButton = true,
  ...props
}: DialogPrimitive.Popup.Props & { showCloseButton?: boolean }) {
  return (
    <ModalPortal data-slot="modal-portal">
      <ModalOverlay forceRender />
      <DialogPrimitive.Viewport className="fixed inset-0 flex items-center justify-center overflow-hidden overscroll-contain py-12">
        <DialogPrimitive.Popup
          data-slot="modal-content"
          className={cn(
            "relative flex max-h-[85vh] min-h-0 w-full max-w-[calc(100%-2rem)] flex-col gap-0 overflow-hidden p-0 sm:max-w-xl",
            "rounded-lg border bg-background text-foreground shadow-lg outline-hidden",
            "data-open:fade-in-0 data-open:zoom-in-95 data-open:animate-in data-open:duration-200",
            "data-closed:fade-out-0 data-closed:zoom-out-95 data-closed:animate-out data-closed:duration-200",
            className,
          )}
          {...props}
        >
          {children}
          {showCloseButton && <ModalClose className="absolute top-2 right-2" />}
        </DialogPrimitive.Popup>
      </DialogPrimitive.Viewport>
    </ModalPortal>
  );
}

function ModalHeader({
  className,
  ...props
}: React.ComponentPropsWithoutRef<"div">) {
  return (
    <div
      data-slot="modal-header"
      className={cn(
        "flex flex-col gap-1 border-muted border-b bg-card/60 p-4",
        className,
      )}
      {...props}
    />
  );
}

function ModalFooter({
  className,
  ...props
}: React.ComponentPropsWithoutRef<"div">) {
  return (
    <div
      data-slot="modal-footer"
      className={cn(
        "flex flex-col-reverse gap-2 sm:flex-row sm:justify-end",
        "-mx-5 -mb-5 rounded-b-lg border-border border-t bg-muted/30 p-3",
        className,
      )}
      {...props}
    />
  );
}

function ModalTitle({ className, ...props }: DialogPrimitive.Title.Props) {
  return (
    <DialogPrimitive.Title
      data-slot="modal-title"
      className={cn("font-semibold text-base", className)}
      {...props}
    />
  );
}

function ModalDescription({
  className,
  ...props
}: DialogPrimitive.Description.Props) {
  return (
    <DialogPrimitive.Description
      data-slot="modal-description"
      className={cn(
        "text-balance text-muted-foreground text-sm md:text-pretty *:[a]:underline *:[a]:underline-offset-3 *:[a]:hover:text-foreground",
        className,
      )}
      {...props}
    />
  );
}

export {
  Modal,
  ModalContent,
  ModalClose,
  ModalOverlay,
  ModalPortal,
  ModalHeader,
  ModalTitle,
  ModalDescription,
  ModalFooter,
};

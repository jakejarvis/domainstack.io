import { Dialog as DialogPrimitive } from "@base-ui/react/dialog";
import { XIcon } from "@phosphor-icons/react/ssr";
import { cn } from "@/lib/utils";
import { Button } from "./button";

function Dialog({ ...props }: DialogPrimitive.Root.Props) {
  return <DialogPrimitive.Root data-slot="dialog" {...props} />;
}

function DialogTrigger({ ...props }: DialogPrimitive.Trigger.Props) {
  return <DialogPrimitive.Trigger data-slot="dialog-trigger" {...props} />;
}

function DialogPortal({ ...props }: DialogPrimitive.Portal.Props) {
  return <DialogPrimitive.Portal data-slot="dialog-portal" {...props} />;
}

function DialogClose({ ...props }: DialogPrimitive.Close.Props) {
  return <DialogPrimitive.Close data-slot="dialog-close" {...props} />;
}

function DialogOverlay({
  className,
  ...props
}: DialogPrimitive.Backdrop.Props) {
  return (
    <DialogPrimitive.Backdrop
      data-slot="dialog-overlay"
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

function DialogContent({
  className,
  children,
  showCloseButton = true,
  ...props
}: DialogPrimitive.Popup.Props & {
  showCloseButton?: boolean;
}) {
  return (
    <DialogPortal data-slot="dialog-portal">
      <DialogOverlay forceRender />
      <DialogPrimitive.Viewport className="fixed inset-0 flex items-center justify-center overflow-hidden py-12">
        <DialogPrimitive.Popup
          data-slot="dialog-content"
          className={cn(
            "group/dialog-content",
            "relative flex max-h-full min-h-0 w-[min(40rem,calc(100vw-2rem))] max-w-full flex-col overflow-hidden sm:max-w-lg",
            "gap-4 rounded-lg border border-border/60 bg-background p-5 text-foreground shadow-lg outline-hidden",
            "data-open:fade-in-0 data-open:zoom-in-95 data-open:animate-in data-open:duration-200",
            "data-closed:fade-out-0 data-closed:zoom-out-95 data-closed:animate-out data-closed:duration-200",
            // Nested dialog styling: Dim the parent popup
            "data-[nested-dialog-open]:after:absolute data-[nested-dialog-open]:after:inset-0 data-[nested-dialog-open]:after:z-50 data-[nested-dialog-open]:after:rounded-[inherit] data-[nested-dialog-open]:after:bg-black/10 data-[nested-dialog-open]:after:content-['']",
            // Prevent interaction with parent dialog when nested dialog is open
            // This ensures clicks fall through to the nested backdrop (if rendered) or are treated as outside clicks
            "data-[nested-dialog-open]:pointer-events-none",
            className,
          )}
          {...props}
        >
          {children}
          {showCloseButton && (
            <DialogPrimitive.Close
              data-slot="dialog-close"
              className="absolute top-2 right-2"
              render={
                <Button variant="ghost" size="icon-xs" className="rounded">
                  <XIcon className="size-4" />
                  <span className="sr-only">Close</span>
                </Button>
              }
            />
          )}
        </DialogPrimitive.Popup>
      </DialogPrimitive.Viewport>
    </DialogPortal>
  );
}

function DialogHeader({
  className,
  ...props
}: React.ComponentPropsWithoutRef<"div">) {
  return (
    <div
      data-slot="dialog-header"
      className={cn(
        "grid grid-rows-[auto_1fr] place-items-center gap-2 text-center has-data-[slot=dialog-media]:grid-rows-[auto_auto_1fr] has-data-[slot=dialog-media]:gap-x-4 sm:place-items-start sm:gap-1 sm:text-left sm:has-data-[slot=dialog-media]:grid-cols-[auto_1fr] sm:has-data-[slot=dialog-media]:grid-rows-[auto_1fr]",
        className,
      )}
      {...props}
    />
  );
}

function DialogFooter({
  className,
  ...props
}: React.ComponentPropsWithoutRef<"div">) {
  return (
    <div
      data-slot="dialog-footer"
      className={cn(
        "flex flex-col-reverse gap-2 sm:flex-row sm:justify-end",
        "-mx-5 -mb-5 rounded-b-lg border-border/60 border-t bg-muted/30 p-3",
        className,
      )}
      {...props}
    />
  );
}

function DialogMedia({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="dialog-media"
      className={cn(
        "mb-2 inline-flex size-12 items-center justify-center rounded-full bg-muted/30",
        "sm:row-span-2 *:[svg:not([class*='size-'])]:size-6",
        className,
      )}
      {...props}
    />
  );
}

function DialogTitle({ className, ...props }: DialogPrimitive.Title.Props) {
  return (
    <DialogPrimitive.Title
      data-slot="dialog-title"
      className={cn(
        "font-semibold text-base sm:group-has-data-[slot=dialog-media]/dialog-content:col-start-2",
        className,
      )}
      {...props}
    />
  );
}

function DialogDescription({
  className,
  ...props
}: DialogPrimitive.Description.Props) {
  return (
    <DialogPrimitive.Description
      data-slot="dialog-description"
      className={cn(
        "text-balance text-muted-foreground text-sm sm:group-has-data-[slot=dialog-media]/dialog-content:col-start-2 md:text-pretty *:[a]:underline *:[a]:underline-offset-3 *:[a]:hover:text-foreground",
        className,
      )}
      {...props}
    />
  );
}

export {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogMedia,
  DialogOverlay,
  DialogPortal,
  DialogTitle,
  DialogTrigger,
};

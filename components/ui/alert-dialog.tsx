import { AlertDialog as AlertDialogPrimitive } from "@base-ui/react/alert-dialog";
import type { VariantProps } from "class-variance-authority";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type BaseUIClickEvent = React.MouseEvent<HTMLButtonElement, MouseEvent> & {
  preventBaseUIHandler: () => void;
  readonly baseUIHandlerPrevented?: boolean;
};

function AlertDialog({ ...props }: AlertDialogPrimitive.Root.Props) {
  return <AlertDialogPrimitive.Root data-slot="alert-dialog" {...props} />;
}

function AlertDialogTrigger({ ...props }: AlertDialogPrimitive.Trigger.Props) {
  return (
    <AlertDialogPrimitive.Trigger data-slot="alert-dialog-trigger" {...props} />
  );
}

function AlertDialogPortal({ ...props }: AlertDialogPrimitive.Portal.Props) {
  return (
    <AlertDialogPrimitive.Portal data-slot="alert-dialog-portal" {...props} />
  );
}

function AlertDialogOverlay({
  className,
  ...props
}: AlertDialogPrimitive.Backdrop.Props) {
  return (
    <AlertDialogPrimitive.Backdrop
      data-slot="alert-dialog-overlay"
      className={cn(
        "fixed inset-0 z-50 bg-black/50 transition-opacity will-change-[opacity]",
        "data-[ending-style]:opacity-0 data-[starting-style]:opacity-0",
        // iOS 26+: ensure backdrops cover the visual viewport
        "supports-[-webkit-touch-callout:none]:absolute",
        className,
      )}
      {...props}
    />
  );
}

function AlertDialogContent({
  className,
  ...props
}: AlertDialogPrimitive.Popup.Props) {
  return (
    <AlertDialogPortal>
      <AlertDialogOverlay forceRender />
      <AlertDialogPrimitive.Popup
        data-slot="alert-dialog-content"
        className={cn(
          "fixed top-1/2 left-1/2 z-50 grid w-full max-w-[calc(100%-2rem)] -translate-x-1/2 -translate-y-1/2 gap-4 rounded-lg border bg-background p-6 text-foreground shadow-lg outline-hidden sm:max-w-lg",
          "transition-[transform,opacity] duration-200 will-change-[transform,opacity]",
          "data-[starting-style]:scale-95 data-[starting-style]:opacity-0",
          "data-[ending-style]:scale-95 data-[ending-style]:opacity-0",
          // Nested dialog styling: Dim the parent popup
          "data-[nested-dialog-open]:after:absolute data-[nested-dialog-open]:after:inset-0 data-[nested-dialog-open]:after:z-50 data-[nested-dialog-open]:after:rounded-[inherit] data-[nested-dialog-open]:after:bg-black/10 data-[nested-dialog-open]:after:content-['']",
          // Prevent interaction with parent dialog when nested dialog is open
          "data-[nested-dialog-open]:pointer-events-none",
          className,
        )}
        {...props}
      />
    </AlertDialogPortal>
  );
}

function AlertDialogHeader({
  className,
  ...props
}: React.ComponentPropsWithoutRef<"div">) {
  return (
    <div
      data-slot="alert-dialog-header"
      className={cn("flex flex-col gap-2 text-center sm:text-left", className)}
      {...props}
    />
  );
}

function AlertDialogFooter({
  className,
  ...props
}: React.ComponentPropsWithoutRef<"div">) {
  return (
    <div
      data-slot="alert-dialog-footer"
      className={cn(
        "flex flex-col-reverse gap-2 sm:flex-row sm:justify-end",
        className,
      )}
      {...props}
    />
  );
}

function AlertDialogTitle({
  className,
  ...props
}: AlertDialogPrimitive.Title.Props) {
  return (
    <AlertDialogPrimitive.Title
      data-slot="alert-dialog-title"
      className={cn("font-semibold text-lg", className)}
      {...props}
    />
  );
}

function AlertDialogDescription({
  className,
  ...props
}: AlertDialogPrimitive.Description.Props) {
  return (
    <AlertDialogPrimitive.Description
      data-slot="alert-dialog-description"
      className={cn("text-muted-foreground text-sm", className)}
      {...props}
    />
  );
}

function AlertDialogAction({
  variant = "default",
  size = "default",
  className,
  closeOnClick = true,
  onClick,
  ...props
}: AlertDialogPrimitive.Close.Props &
  VariantProps<typeof buttonVariants> & {
    /** Prevent the dialog from closing when this button is clicked. */
    closeOnClick?: boolean;
  }) {
  /**
   * Base UI AlertDialog doesn’t have separate Action/Cancel parts; it only exposes `Close`.
   * We keep the shadcn-style names for ergonomics, but note:
   * - Both Action and Cancel close by default.
   * - For async “confirm” flows where you want to keep the dialog open, set `closeOnClick={false}`
   *   (or call `event.preventBaseUIHandler()` inside `onClick`) and close manually via controlled state.
   */
  const handleClick = (event: BaseUIClickEvent) => {
    if (!closeOnClick) {
      // Base UI escape hatch to prevent its internal click handler.
      event.preventBaseUIHandler();
    }
    onClick?.(event);
  };

  return (
    <AlertDialogPrimitive.Close
      data-slot="alert-dialog-action"
      onClick={handleClick}
      className={cn(buttonVariants({ variant, size }), className)}
      {...props}
    />
  );
}

function AlertDialogCancel({
  className,
  closeOnClick = true,
  onClick,
  ...props
}: AlertDialogPrimitive.Close.Props & {
  /** Prevent the dialog from closing when this button is clicked. */
  closeOnClick?: boolean;
}) {
  const handleClick = (event: BaseUIClickEvent) => {
    if (!closeOnClick) {
      event.preventBaseUIHandler();
    }
    onClick?.(event);
  };

  return (
    <AlertDialogPrimitive.Close
      data-slot="alert-dialog-cancel"
      onClick={handleClick}
      className={cn(buttonVariants({ variant: "outline" }), className)}
      {...props}
    />
  );
}

export {
  AlertDialog,
  AlertDialogPortal,
  AlertDialogOverlay,
  AlertDialogTrigger,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogFooter,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogAction,
  AlertDialogCancel,
};

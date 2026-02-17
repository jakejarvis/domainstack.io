"use client";

import { DrawerPreview as DrawerPrimitive } from "@base-ui/react/drawer";

import { cn } from "../utils";

function Drawer({ ...props }: DrawerPrimitive.Root.Props) {
  return <DrawerPrimitive.Root data-slot="drawer" {...props} />;
}

function DrawerTrigger({ ...props }: DrawerPrimitive.Trigger.Props) {
  return <DrawerPrimitive.Trigger data-slot="drawer-trigger" {...props} />;
}

function DrawerPortal({ ...props }: DrawerPrimitive.Portal.Props) {
  return <DrawerPrimitive.Portal data-slot="drawer-portal" {...props} />;
}

function DrawerClose({ ...props }: DrawerPrimitive.Close.Props) {
  return <DrawerPrimitive.Close data-slot="drawer-close" {...props} />;
}

function DrawerOverlay({
  className,
  ...props
}: DrawerPrimitive.Backdrop.Props) {
  return (
    <DrawerPrimitive.Backdrop
      data-slot="drawer-overlay"
      className={cn(
        "data-closed:fade-out-0 data-open:fade-in-0 fixed inset-0 z-50 bg-black/10 backdrop-blur-xs data-closed:animate-out data-open:animate-in",
        // iOS 26+: ensure backdrops cover the visual viewport
        "supports-[-webkit-touch-callout:none]:absolute",
        className,
      )}
      {...props}
    />
  );
}

function DrawerContent({
  className,
  children,
  ...props
}: DrawerPrimitive.Popup.Props) {
  return (
    <DrawerPortal data-slot="drawer-portal">
      <DrawerOverlay />
      <DrawerPrimitive.Viewport className="fixed inset-0 z-50 overflow-hidden overscroll-contain">
        <DrawerPrimitive.Popup
          data-slot="drawer-content"
          className={cn(
            "group/drawer-content fixed z-50 flex h-auto flex-col bg-background text-sm shadow-lg outline-hidden",
            "data-[swipe-direction=right]:data-closed:slide-out-to-right-10 data-[swipe-direction=right]:data-open:slide-in-from-right-10 data-[swipe-direction=left]:data-closed:slide-out-to-left-10 data-[swipe-direction=left]:data-open:slide-in-from-left-10 data-[swipe-direction=up]:data-closed:slide-out-to-top-10 data-[swipe-direction=up]:data-open:slide-in-from-top-10 data-closed:fade-out-0 data-open:fade-in-0 data-[swipe-direction=down]:data-closed:slide-out-to-bottom-10 data-[swipe-direction=down]:data-open:slide-in-from-bottom-10 data-closed:animate-out data-open:animate-in",
            "data-[swipe-direction=down]:inset-x-0 data-[swipe-direction=up]:inset-x-0 data-[swipe-direction=left]:inset-y-0 data-[swipe-direction=right]:inset-y-0 data-[swipe-direction=up]:top-0 data-[swipe-direction=right]:right-0 data-[swipe-direction=down]:bottom-0 data-[swipe-direction=left]:left-0",
            "data-[swipe-direction=down]:mt-24 data-[swipe-direction=up]:mb-24 data-[swipe-direction=left]:h-full data-[swipe-direction=right]:h-full data-[swipe-direction=down]:max-h-[80vh] data-[swipe-direction=up]:max-h-[80vh] data-[swipe-direction=left]:w-3/4 data-[swipe-direction=right]:w-3/4",
            "data-[swipe-direction=down]:rounded-t-xl data-[swipe-direction=left]:rounded-r-xl data-[swipe-direction=up]:rounded-b-xl data-[swipe-direction=right]:rounded-l-xl data-[swipe-direction=down]:border-t data-[swipe-direction=left]:border-r data-[swipe-direction=up]:border-b data-[swipe-direction=right]:border-l data-[swipe-direction=left]:sm:max-w-sm data-[swipe-direction=right]:sm:max-w-sm",
            className,
          )}
          {...props}
        >
          <div
            aria-hidden
            className="mx-auto mt-4 hidden h-1 w-[100px] shrink-0 rounded-full bg-muted group-data-[swipe-direction=down]/drawer-content:block"
          />
          <DrawerPrimitive.Content
            data-slot="drawer-content-inner"
            className="flex min-h-0 flex-1 select-text flex-col"
          >
            {children}
          </DrawerPrimitive.Content>
        </DrawerPrimitive.Popup>
      </DrawerPrimitive.Viewport>
    </DrawerPortal>
  );
}

function DrawerHeader({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="drawer-header"
      className={cn(
        "flex flex-col gap-0.5 p-4 group-data-[swipe-direction=down]/drawer-content:text-center group-data-[swipe-direction=up]/drawer-content:text-center md:gap-0.5 md:text-left",
        className,
      )}
      {...props}
    />
  );
}

function DrawerFooter({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="drawer-footer"
      className={cn("mt-auto flex flex-col gap-2 p-4", className)}
      {...props}
    />
  );
}

function DrawerTitle({ className, ...props }: DrawerPrimitive.Title.Props) {
  return (
    <DrawerPrimitive.Title
      data-slot="drawer-title"
      className={cn("font-medium text-base text-foreground", className)}
      {...props}
    />
  );
}

function DrawerDescription({
  className,
  ...props
}: DrawerPrimitive.Description.Props) {
  return (
    <DrawerPrimitive.Description
      data-slot="drawer-description"
      className={cn("text-muted-foreground text-sm", className)}
      {...props}
    />
  );
}

export {
  Drawer,
  DrawerPortal,
  DrawerOverlay,
  DrawerTrigger,
  DrawerClose,
  DrawerContent,
  DrawerHeader,
  DrawerFooter,
  DrawerTitle,
  DrawerDescription,
};

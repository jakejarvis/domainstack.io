"use client";

import { MessageScroller as MessageScrollerPrimitive } from "@shadcn/react/message-scroller";

import { cn } from "../utils";

export {
  useMessageScroller,
  useMessageScrollerScrollable,
  useMessageScrollerVisibility,
} from "@shadcn/react/message-scroller";

function MessageScrollerProvider(
  props: React.ComponentProps<typeof MessageScrollerPrimitive.Provider>,
) {
  return <MessageScrollerPrimitive.Provider data-slot="message-scroller-provider" {...props} />;
}

function MessageScrollerRoot({
  className,
  ...props
}: React.ComponentProps<typeof MessageScrollerPrimitive.Root>) {
  return (
    <MessageScrollerPrimitive.Root
      data-slot="message-scroller-root"
      className={cn("relative flex min-h-0 flex-1 flex-col overflow-hidden", className)}
      {...props}
    />
  );
}

function MessageScrollerViewport({
  className,
  ...props
}: React.ComponentProps<typeof MessageScrollerPrimitive.Viewport>) {
  return (
    <MessageScrollerPrimitive.Viewport
      data-slot="message-scroller-viewport"
      className={cn(
        "no-scrollbar min-h-0 flex-1 overflow-y-auto overscroll-contain outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-1",
        className,
      )}
      {...props}
    />
  );
}

function MessageScrollerContent({
  className,
  ...props
}: React.ComponentProps<typeof MessageScrollerPrimitive.Content>) {
  return (
    <MessageScrollerPrimitive.Content
      data-slot="message-scroller-content"
      className={cn("flex min-h-full min-w-0 flex-col [contain:inline-size]", className)}
      {...props}
    />
  );
}

function MessageScrollerItem(props: React.ComponentProps<typeof MessageScrollerPrimitive.Item>) {
  return <MessageScrollerPrimitive.Item data-slot="message-scroller-item" {...props} />;
}

export {
  MessageScrollerContent,
  MessageScrollerItem,
  MessageScrollerProvider,
  MessageScrollerRoot,
  MessageScrollerViewport,
};

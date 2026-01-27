"use client";

import { Button } from "@domainstack/ui/button";
import { ScrollArea } from "@domainstack/ui/scroll-area";
import { cn } from "@domainstack/ui/utils";
import { IconArrowDown } from "@tabler/icons-react";
import type { ComponentProps, HTMLAttributes, ReactNode } from "react";
import type { StickToBottomInstance } from "use-stick-to-bottom";

export type ConversationProps = ComponentProps<typeof ScrollArea> & {
  stickyInstance: StickToBottomInstance;
};

export const Conversation = ({
  stickyInstance,
  className,
  ...props
}: ConversationProps) => {
  const { scrollRef, contentRef } = stickyInstance;
  return (
    <ScrollArea
      className={cn("min-h-0 flex-1", className)}
      scrollFade={false}
      scrollRef={scrollRef}
      contentRef={contentRef}
      role="log"
      {...props}
    />
  );
};

export type ConversationContentProps = HTMLAttributes<HTMLDivElement>;

export const ConversationContent = ({
  className,
  ...props
}: ConversationContentProps) => (
  <div
    className={cn(
      "flex min-w-0 flex-1 flex-col gap-8 p-4 [contain:inline-size]",
      className,
    )}
    {...props}
  />
);

export type ConversationEmptyStateProps = HTMLAttributes<HTMLDivElement> & {
  title?: string;
  description?: string;
  icon?: ReactNode;
};

export const ConversationEmptyState = ({
  className,
  title = "No messages yet",
  description = "Start a conversation to see messages here",
  icon,
  children,
  ...props
}: ConversationEmptyStateProps) => (
  <div
    className={cn(
      "flex size-full flex-col items-center justify-center gap-4 p-8 text-center",
      className,
    )}
    {...props}
  >
    {children ?? (
      <>
        {icon && <div className="text-muted-foreground">{icon}</div>}
        <div className="space-y-1">
          <h3 className="font-medium text-sm">{title}</h3>
          {description && (
            <p className="text-pretty text-[13px] text-muted-foreground leading-normal">
              {description}
            </p>
          )}
        </div>
      </>
    )}
  </div>
);

export type ConversationScrollButtonProps = ComponentProps<typeof Button>;

export const ConversationScrollButton = ({
  className,
  ...props
}: ConversationScrollButtonProps) => (
  <Button
    aria-label="Scroll to bottom"
    className={cn(
      "absolute bottom-4 left-1/2 z-10 -translate-x-1/2 rounded-full bg-background/80 shadow-md backdrop-blur-sm",
      className,
    )}
    size="icon"
    variant="outline"
    {...props}
  >
    <IconArrowDown className="size-4" />
  </Button>
);

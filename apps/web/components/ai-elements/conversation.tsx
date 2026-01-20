"use client";

import { ArrowDownIcon } from "@phosphor-icons/react";
import {
  type ComponentProps,
  type HTMLAttributes,
  type MutableRefObject,
  type ReactNode,
  useCallback,
  useEffect,
} from "react";
import { StickToBottom, useStickToBottomContext } from "use-stick-to-bottom";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export type ConversationProps = ComponentProps<typeof StickToBottom>;

export const Conversation = ({ className, ...props }: ConversationProps) => (
  <StickToBottom
    className={cn(
      "relative min-w-0 flex-1 overflow-y-auto overflow-x-hidden",
      className,
    )}
    initial="smooth"
    resize="smooth"
    role="log"
    {...props}
  />
);

export type ConversationContentProps = ComponentProps<
  typeof StickToBottom.Content
>;

export const ConversationContent = ({
  className,
  ...props
}: ConversationContentProps) => (
  <StickToBottom.Content
    className={cn("flex min-w-0 flex-col gap-8 p-4", className)}
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
      "flex size-full flex-col items-center justify-center gap-3 p-8 text-center",
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

export type ScrollToBottomRef = MutableRefObject<(() => void) | null>;

export type ConversationScrollAnchorProps = {
  scrollRef: ScrollToBottomRef;
};

/** Captures scrollToBottom function into a ref for use outside the Conversation tree */
export const ConversationScrollAnchor = ({
  scrollRef,
}: ConversationScrollAnchorProps) => {
  const { scrollToBottom } = useStickToBottomContext();

  useEffect(() => {
    scrollRef.current = () => scrollToBottom();
  }, [scrollRef, scrollToBottom]);

  return null;
};

export type ConversationScrollButtonProps = ComponentProps<typeof Button>;

export const ConversationScrollButton = ({
  className,
  ...props
}: ConversationScrollButtonProps) => {
  const { isAtBottom, scrollToBottom } = useStickToBottomContext();

  const handleScrollToBottom = useCallback(() => {
    void scrollToBottom();
  }, [scrollToBottom]);

  if (isAtBottom) return null;

  return (
    <Button
      className={cn(
        "absolute bottom-4 left-1/2 z-10 -translate-x-1/2 rounded-full shadow-md",
        className,
      )}
      onClick={handleScrollToBottom}
      size="icon"
      variant="outline"
      {...props}
    >
      <ArrowDownIcon className="size-4" />
    </Button>
  );
};

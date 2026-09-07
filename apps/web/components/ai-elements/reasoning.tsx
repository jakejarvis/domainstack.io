"use client";

import { IconBrain, IconChevronDown } from "@tabler/icons-react";
import type { ComponentProps, ReactNode } from "react";
import { createContext, memo, useContext, useEffect, useMemo, useRef, useState } from "react";
import { Streamdown } from "streamdown";

import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@domainstack/ui/collapsible";
import { cn } from "@domainstack/ui/utils";

import { ShimmeringText } from "./shimmering-text";

interface ReasoningContextValue {
  isStreaming: boolean;
  isOpen: boolean;
  setIsOpen: (open: boolean) => void;
  duration: number | undefined;
  hasContent: boolean;
}

const ReasoningContext = createContext<ReasoningContextValue | null>(null);

export const useReasoning = () => {
  const context = useContext(ReasoningContext);
  if (!context) {
    throw new Error("Reasoning components must be used within Reasoning");
  }
  return context;
};

export type ReasoningProps = ComponentProps<typeof Collapsible> & {
  isStreaming?: boolean;
  hasContent?: boolean;
};

const AUTO_CLOSE_DELAY = 1000;
const MS_IN_S = 1000;

export const Reasoning = memo(
  ({
    className,
    isStreaming = false,
    defaultOpen = true,
    onOpenChange,
    hasContent = true,
    children,
    ...props
  }: ReasoningProps) => {
    const [isOpen, setIsOpen] = useState(defaultOpen);
    const [duration, setDuration] = useState<number | undefined>();
    const [hasAutoClosed, setHasAutoClosed] = useState(false);
    const startTimeRef = useRef<number | null>(null);

    // Track duration when streaming starts and ends. Wall-clock timing has to
    // live in an effect; start time is stored in a ref so we only setState once
    // streaming finishes.
    useEffect(() => {
      if (isStreaming) {
        startTimeRef.current ??= Date.now();
        return;
      }
      if (startTimeRef.current !== null) {
        setDuration(Math.ceil((Date.now() - startTimeRef.current) / MS_IN_S));
        startTimeRef.current = null;
      }
    }, [isStreaming]);

    // Auto-open when streaming starts, auto-close when streaming ends (once only)
    useEffect(() => {
      if (hasContent && defaultOpen && !isStreaming && isOpen && !hasAutoClosed) {
        // Add a small delay before closing to allow user to see the content
        const timer = setTimeout(() => {
          setIsOpen(false);
          setHasAutoClosed(true);
        }, AUTO_CLOSE_DELAY);

        return () => clearTimeout(timer);
      }
    }, [hasContent, isStreaming, isOpen, defaultOpen, hasAutoClosed]);

    const handleOpenChange: NonNullable<ReasoningProps["onOpenChange"]> = (
      newOpen,
      eventDetails,
    ) => {
      setIsOpen(newOpen);
      onOpenChange?.(newOpen, eventDetails);
    };
    const open = hasContent && isOpen;
    const contextValue = useMemo(
      () => ({ isStreaming, isOpen: open, setIsOpen, duration, hasContent }),
      [isStreaming, open, duration, hasContent],
    );

    return (
      <ReasoningContext.Provider value={contextValue}>
        <Collapsible
          {...props}
          className={cn("text-muted-foreground", className)}
          onOpenChange={handleOpenChange}
          open={open}
        >
          {children}
        </Collapsible>
      </ReasoningContext.Provider>
    );
  },
);

export type ReasoningTriggerProps = ComponentProps<typeof CollapsibleTrigger> & {
  getThinkingMessage?: (isStreaming: boolean, duration?: number) => ReactNode;
};

const defaultGetThinkingMessage = (isStreaming: boolean, duration?: number) => {
  if (isStreaming || duration === 0) {
    return <ShimmeringText text="Thinking…" startOnView={false} />;
  }
  if (duration === undefined) {
    return <p>Thought for a few seconds</p>;
  }
  return <p>Thought for {duration} seconds</p>;
};

export const ReasoningTrigger = memo(
  ({
    className,
    children,
    getThinkingMessage = defaultGetThinkingMessage,
    ...props
  }: ReasoningTriggerProps) => {
    const { isStreaming, isOpen, duration, hasContent } = useReasoning();
    const label = children ?? (
      <>
        <IconBrain className="size-3.5" aria-hidden />
        {getThinkingMessage(isStreaming, duration)}
        {hasContent ? (
          <IconChevronDown
            className={cn("size-3 transition-transform", isOpen ? "rotate-180" : "rotate-0")}
          />
        ) : null}
      </>
    );
    const triggerClassName = cn(
      "flex w-full items-center gap-2 text-[13px] text-muted-foreground",
      hasContent && "hover:text-foreground",
      className,
    );

    if (!hasContent) {
      return <div className={triggerClassName}>{label}</div>;
    }

    return (
      <CollapsibleTrigger className={triggerClassName} {...props}>
        {label}
      </CollapsibleTrigger>
    );
  },
);

export type ReasoningContentProps = ComponentProps<typeof CollapsibleContent> & {
  children: string;
};

export const ReasoningContent = memo(({ className, children, ...props }: ReasoningContentProps) => (
  <CollapsibleContent className={cn("mt-4 text-sm", className)} {...props}>
    <Streamdown>{children}</Streamdown>
  </CollapsibleContent>
));

Reasoning.displayName = "Reasoning";
ReasoningTrigger.displayName = "ReasoningTrigger";
ReasoningContent.displayName = "ReasoningContent";

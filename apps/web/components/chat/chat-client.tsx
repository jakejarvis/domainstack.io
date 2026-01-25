"use client";

import { ChatsIcon, WarningCircleIcon, XIcon } from "@phosphor-icons/react";
import type { ChatStatus, ToolUIPart, UIMessage } from "ai";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useStickToBottom } from "use-stick-to-bottom";
import {
  Conversation,
  ConversationContent,
  ConversationEmptyState,
  ConversationScrollButton,
} from "@/components/ai-elements/conversation";
import {
  Message,
  MessageContent,
  MessageResponse,
} from "@/components/ai-elements/message";
import {
  PromptInput,
  PromptInputCharacterCount,
  PromptInputFooter,
  PromptInputSubmit,
  PromptInputTextarea,
} from "@/components/ai-elements/prompt-input";
import { ShimmeringText } from "@/components/ai-elements/shimmering-text";
import { Suggestion, Suggestions } from "@/components/ai-elements/suggestion";
import {
  Tool,
  ToolContent,
  ToolHeader,
  ToolInput,
  ToolOutput,
} from "@/components/ai-elements/tool";
import { Button } from "@/components/ui/button";
import { useAiPreferences } from "@/hooks/use-ai-preferences";
import { MAX_MESSAGE_LENGTH } from "@/lib/constants/ai";
import { cn } from "@/lib/utils";
import { getToolStatusMessage } from "./utils";

/** Tool card that auto-expands when the tool completes */
function AutoExpandTool({
  toolPart,
  isStreamComplete,
  onExpand,
}: {
  toolPart: ToolUIPart;
  /** Whether the stream has finished (status is "ready") */
  isStreamComplete: boolean;
  /** Called when the tool auto-expands (e.g., to scroll into view) */
  onExpand?: () => void;
}) {
  // If stream is done but tool never got output, treat as error
  const isStuckPending =
    isStreamComplete && toolPart.state === "input-available";

  const effectiveState: ToolUIPart["state"] = isStuckPending
    ? "output-error"
    : toolPart.state;

  const effectiveErrorText = isStuckPending
    ? "Tool execution failed. The model may not support tool calling."
    : toolPart.errorText;

  const isComplete =
    effectiveState === "output-available" || effectiveState === "output-error";

  const [open, setOpen] = useState(isComplete);

  // Auto-expand when tool completes (or errors)
  useEffect(() => {
    if (isComplete) {
      setOpen(true);
      onExpand?.();
    }
  }, [isComplete, onExpand]);

  return (
    <Tool open={open} onOpenChange={setOpen}>
      <ToolHeader
        title={getToolStatusMessage(toolPart.type)}
        type={toolPart.type}
        state={effectiveState}
      />
      <ToolContent>
        <ToolInput input={toolPart.input} />
        <ToolOutput output={toolPart.output} errorText={effectiveErrorText} />
      </ToolContent>
    </Tool>
  );
}

export interface ChatClientProps {
  messages: UIMessage[];
  sendMessage: (params: { text: string }) => void;
  clearMessages: () => void;
  status: ChatStatus;
  domain?: string;
  error?: string | null;
  onClearError?: () => void;
  /** Size variant for icon in empty state */
  iconSize?: "sm" | "lg";
  /** Additional class for the conversation container */
  conversationClassName?: string;
  /** Additional class for the input container */
  inputClassName?: string;
  /** Pre-generated suggestions from server */
  suggestions?: string[];
}

export function ChatClient({
  messages,
  sendMessage,
  clearMessages,
  status,
  domain,
  error,
  onClearError,
  iconSize = "sm",
  conversationClassName,
  inputClassName,
  suggestions = [],
}: ChatClientProps) {
  const [inputLength, setInputLength] = useState(0);
  const { showToolCalls } = useAiPreferences();

  // Prepare to share scroll state between the different components
  const stickyInstance = useStickToBottom();

  const placeholder = domain
    ? `Ask about ${domain}\u2026`
    : "Ask about a domain\u2026";

  // When viewing a domain report, generate domain-specific suggestions client-side.
  // Otherwise, use the pre-generated suggestions from the server.
  const displaySuggestions = useMemo(() => {
    if (domain) {
      return [
        `When does ${domain} expire?`,
        `Is ${domain} missing any important security headers?`,
        `Which email provider does ${domain} use?`,
        `Is ${domain}'s SSL certificate valid?`,
      ];
    }
    return suggestions;
  }, [domain, suggestions]);

  const handleScrollToBottom = useCallback(() => {
    void stickyInstance.scrollToBottom();
  }, [stickyInstance.scrollToBottom]);

  const handleSubmit = (message: { text: string }) => {
    sendMessage(message);
    handleScrollToBottom();
    setInputLength(0);
  };

  const handleSuggestionClick = (suggestion: string) => {
    clearMessages();
    onClearError?.();
    sendMessage({ text: suggestion });
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInputLength(e.target.value.length);
    onClearError?.();
  };

  // Show loading indicator when waiting for response or when streaming but no text yet
  // (e.g., after tool calls complete but before the final text response starts)
  const lastMessage = messages[messages.length - 1];
  const hasVisibleText =
    lastMessage?.role === "assistant" &&
    lastMessage.parts.some(
      (part) => part.type === "text" && part.text.trim().length > 0,
    );
  const showLoading =
    status === "submitted" ||
    (status === "streaming" &&
      lastMessage?.role === "assistant" &&
      !hasVisibleText);

  return (
    <>
      <Conversation
        stickyInstance={stickyInstance}
        className={cn(
          "min-h-0 flex-1 bg-popover/10 [&_[data-slot=scroll-area-content]]:flex [&_[data-slot=scroll-area-content]]:min-h-full [&_[data-slot=scroll-area-content]]:flex-col",
          conversationClassName,
        )}
      >
        <ConversationContent
          className={cn(
            messages.length === 0
              ? "items-center justify-center"
              : "gap-4 px-3 py-4",
          )}
          aria-live="polite"
        >
          {messages.length === 0 ? (
            <ConversationEmptyState
              icon={
                <ChatsIcon
                  className={iconSize === "lg" ? "size-8" : "size-6"}
                />
              }
              title={
                iconSize === "lg"
                  ? "Ask me anything about domains!"
                  : "Ask me anything!"
              }
              description={
                domain
                  ? `I can look up DNS, WHOIS, SSL, and more for ${domain}`
                  : "I can look up DNS records, WHOIS data, SSL certificates, and more"
              }
            />
          ) : (
            <>
              {messages.map((message) => (
                <Message key={message.id} from={message.role}>
                  <MessageContent>
                    {message.parts.map((part, index) => {
                      if (part.type === "text") {
                        return (
                          <MessageResponse key={`${message.id}-${index}`}>
                            {part.text}
                          </MessageResponse>
                        );
                      }
                      if (part.type.startsWith("tool-") && showToolCalls) {
                        return (
                          <AutoExpandTool
                            key={`${message.id}-${index}`}
                            toolPart={part as ToolUIPart}
                            isStreamComplete={status === "ready"}
                            onExpand={handleScrollToBottom}
                          />
                        );
                      }
                      return null;
                    })}
                  </MessageContent>
                </Message>
              ))}
              {showLoading && (
                <ShimmeringText text="Thinking…" className="text-sm" />
              )}
            </>
          )}
        </ConversationContent>
        {!stickyInstance.isNearBottom && (
          <ConversationScrollButton onClick={handleScrollToBottom} />
        )}
      </Conversation>

      <div
        className={cn(
          "!pt-3 shrink-0 space-y-3 border-border border-t bg-card/60",
          inputClassName,
        )}
      >
        <Suggestions className="justify-center">
          {displaySuggestions.map((suggestion) => (
            <Suggestion
              key={suggestion}
              suggestion={suggestion}
              onClick={handleSuggestionClick}
            />
          ))}
        </Suggestions>

        {error && (
          <div
            role="alert"
            className="flex items-center gap-2 rounded-md border border-destructive/15 bg-destructive/10 px-2 py-1.5 text-[13px] text-destructive leading-tight"
          >
            <WarningCircleIcon className="size-4 shrink-0" />
            <span className="flex-1">{error}</span>
            {onClearError && (
              <Button
                variant="ghost"
                size="icon-xs"
                onClick={onClearError}
                aria-label="Dismiss error"
                className="hover:!bg-destructive/20 hover:!text-destructive shrink-0 text-destructive"
              >
                <XIcon className="size-3" />
              </Button>
            )}
          </div>
        )}

        <PromptInput onSubmit={handleSubmit}>
          <PromptInputTextarea
            placeholder={placeholder}
            onChange={handleInputChange}
            maxLength={MAX_MESSAGE_LENGTH}
          />
          <PromptInputFooter>
            <PromptInputCharacterCount
              current={inputLength}
              max={MAX_MESSAGE_LENGTH}
            />
            <PromptInputSubmit
              disabled={inputLength === 0}
              status={error ? "error" : status}
            />
          </PromptInputFooter>
        </PromptInput>
      </div>
    </>
  );
}

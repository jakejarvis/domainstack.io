"use client";

import { IconAlertCircle, IconBrain, IconMessages, IconX } from "@tabler/icons-react";
import type { ChatStatus, ToolUIPart, UIMessage } from "ai";
import { useCallback, useState } from "react";
import { useStickToBottom } from "use-stick-to-bottom";

import {
  Conversation,
  ConversationContent,
  ConversationEmptyState,
  ConversationScrollButton,
} from "@/components/ai-elements/conversation";
import { Message, MessageContent, MessageResponse } from "@/components/ai-elements/message";
import {
  PromptInput,
  PromptInputCharacterCount,
  PromptInputFooter,
  PromptInputSubmit,
  PromptInputTextarea,
} from "@/components/ai-elements/prompt-input";
import { Reasoning, ReasoningContent, ReasoningTrigger } from "@/components/ai-elements/reasoning";
import { ShimmeringText } from "@/components/ai-elements/shimmering-text";
import { Suggestion, Suggestions } from "@/components/ai-elements/suggestion";
import {
  Tool,
  ToolContent,
  ToolHeader,
  ToolInput,
  ToolOutput,
} from "@/components/ai-elements/tool";
import { type UseBrowserAIResult } from "@/hooks/use-browser-ai";
import { getDomainToolStatus } from "@/lib/chat/domain-tools";
import { usePreferencesStore } from "@/lib/stores/preferences-store";
import { MAX_MESSAGE_LENGTH } from "@domainstack/constants";
import { Button } from "@domainstack/ui/button";
import { cn } from "@domainstack/ui/utils";

import { ChatModeSelector } from "./chat-mode-selector";

const EMPTY_SUGGESTIONS: string[] = [];

function getMessagePartItems(message: UIMessage) {
  const seen = new Map<string, number>();

  return message.parts.map((part, position) => {
    const baseKey =
      part.type === "text" || part.type === "reasoning" ? `${part.type}-${part.text}` : part.type;
    const duplicateCount = seen.get(baseKey) ?? 0;
    seen.set(baseKey, duplicateCount + 1);

    return {
      key: `${message.id}-${baseKey}-${duplicateCount}`,
      part,
      position,
    };
  });
}

function getReportSuggestions(domain: string): string[] {
  return [
    `When does ${domain} expire?`,
    `Is ${domain} missing any important security headers?`,
    `Which email provider does ${domain} use?`,
    `Is ${domain}'s SSL certificate valid?`,
  ];
}

interface ChatPanelProps {
  messages: UIMessage[];
  sendMessage: (params: { text: string }) => void;
  clearMessages: () => void;
  status: ChatStatus;
  domain?: string;
  error?: string | null;
  onClearError?: () => void;
  homeSuggestions?: string[];
  browserAI: UseBrowserAIResult;
  conversationClassName?: string;
  inputClassName?: string;
}

export function ChatPanel({
  messages,
  sendMessage,
  clearMessages,
  status,
  domain,
  error,
  onClearError,
  homeSuggestions = EMPTY_SUGGESTIONS,
  browserAI,
  conversationClassName,
  inputClassName,
}: ChatPanelProps) {
  const [inputLength, setInputLength] = useState(0);
  const showToolCalls = usePreferencesStore((s) => s.showToolCalls);
  const showReasoning = usePreferencesStore((s) => s.showReasoning);

  const stickyInstance = useStickToBottom();

  const placeholder = domain ? `Ask about ${domain}\u2026` : "Ask about a domain\u2026";
  const suggestions = domain ? getReportSuggestions(domain) : homeSuggestions;

  const { scrollToBottom } = stickyInstance;
  const handleScrollToBottom = useCallback(() => {
    void scrollToBottom();
  }, [scrollToBottom]);

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
          className={cn(messages.length === 0 ? "items-center justify-center" : "gap-4 px-3 py-4")}
          aria-live="polite"
        >
          {messages.length === 0 ? (
            <ConversationEmptyState
              icon={<IconMessages className="size-7" />}
              title={`Ask me anything about ${domain ?? "domains"}!`}
              description="I can look up DNS records, WHOIS data, SSL certificates, and more — just say the word."
            />
          ) : (
            <>
              {messages.map((message) => (
                <Message key={message.id} from={message.role}>
                  <MessageContent>
                    {getMessagePartItems(message).map(({ key, part, position }) => {
                      if (part.type === "text") {
                        return <MessageResponse key={key}>{part.text}</MessageResponse>;
                      }
                      if (part.type === "reasoning") {
                        const isStreaming =
                          status === "streaming" &&
                          position === message.parts.length - 1 &&
                          message.id === messages.at(-1)?.id;
                        if (showReasoning) {
                          return (
                            <Reasoning key={key} className="w-full" isStreaming={isStreaming}>
                              <ReasoningTrigger />
                              <ReasoningContent>{part.text}</ReasoningContent>
                            </Reasoning>
                          );
                        }

                        return isStreaming ? (
                          <div
                            key={key}
                            className="flex items-center gap-2 text-[13px] text-muted-foreground"
                          >
                            <IconBrain className="size-3.5" />
                            <ShimmeringText text="Thinking…" />
                          </div>
                        ) : null;
                      }
                      if (part.type.startsWith("tool-") && showToolCalls) {
                        const toolPart = part as ToolUIPart;
                        return (
                          <Tool key={key}>
                            <ToolHeader
                              title={getDomainToolStatus(toolPart.type)}
                              type={toolPart.type}
                              state={toolPart.state}
                            />
                            <ToolContent>
                              <ToolInput input={toolPart.input} />
                              {toolPart.state === "output-available" && (
                                <ToolOutput
                                  output={toolPart.output}
                                  errorText={toolPart.errorText}
                                />
                              )}
                            </ToolContent>
                          </Tool>
                        );
                      }
                      return null;
                    })}
                  </MessageContent>
                </Message>
              ))}
              {/* Show loading indicator while waiting for response stream to begin */}
              {status === "submitted" && (
                <Message from="assistant">
                  <MessageContent>
                    <ShimmeringText text="Thinking…" />
                  </MessageContent>
                </Message>
              )}
            </>
          )}
        </ConversationContent>
        {!stickyInstance.isNearBottom && (
          <ConversationScrollButton onClick={handleScrollToBottom} />
        )}
      </Conversation>

      <div
        className={cn("shrink-0 space-y-3 border-t border-border bg-card/60 !pt-3", inputClassName)}
      >
        <Suggestions className="justify-center">
          {suggestions.map((suggestion) => (
            <Suggestion key={suggestion} suggestion={suggestion} onClick={handleSuggestionClick} />
          ))}
        </Suggestions>

        {error && (
          <div
            role="alert"
            className="flex items-center gap-2 rounded-md border border-destructive/15 bg-destructive/10 px-2 py-1.5 text-[13px] leading-tight text-destructive"
          >
            <IconAlertCircle className="size-4 shrink-0" />
            <span className="flex-1">{error}</span>
            {onClearError && (
              <Button
                variant="ghost"
                size="icon-xs"
                onClick={onClearError}
                aria-label="Dismiss error"
                className="shrink-0 text-destructive hover:!bg-destructive/20 hover:!text-destructive"
              >
                <IconX className="size-3" />
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
          <PromptInputFooter className="pr-1.5 pb-1.5 pl-3">
            <PromptInputCharacterCount current={inputLength} max={MAX_MESSAGE_LENGTH} />
            <div className="flex items-center gap-2">
              <ChatModeSelector
                browserAI={browserAI}
                disabled={status === "submitted" || status === "streaming"}
              />
              <PromptInputSubmit disabled={inputLength === 0} status={error ? "error" : status} />
            </div>
          </PromptInputFooter>
        </PromptInput>
      </div>
    </>
  );
}

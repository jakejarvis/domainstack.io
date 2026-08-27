"use client";

import { IconAlertCircle, IconBrain, IconMessages, IconRefresh, IconX } from "@tabler/icons-react";
import { type ChatStatus, isTextUIPart, isToolUIPart, type ToolUIPart, type UIMessage } from "ai";
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
import { ChatModeSelector } from "@/components/chat/chat-mode-selector";
import { type UseBrowserAIResult } from "@/hooks/use-browser-ai";
import { getDomainToolStatus, getToolPartType } from "@/lib/chat/domain-tools";
import {
  type AssistantWaitKind,
  getAssistantRenderItems,
  getAssistantWaitStatus,
  hasVisibleAssistantParts,
} from "@/lib/chat/message-parts";
import { usePreferencesStore } from "@/lib/stores/preferences-store";
import { MAX_MESSAGE_LENGTH } from "@domainstack/constants";
import { Button } from "@domainstack/ui/button";
import { Spinner } from "@domainstack/ui/spinner";
import { cn } from "@domainstack/ui/utils";

const EMPTY_SUGGESTIONS: string[] = [];

function AssistantWaitIndicator({ kind }: { kind: AssistantWaitKind }) {
  const isThinking = kind === "thinking";

  return (
    <div
      className="flex items-center gap-2 text-[13px] text-muted-foreground"
      aria-live="polite"
      aria-atomic="true"
    >
      {isThinking ? (
        <IconBrain className="size-3.5" aria-hidden />
      ) : (
        <Spinner className="size-3.5" />
      )}
      <ShimmeringText text={isThinking ? "Thinking…" : "Generating…"} startOnView={false} />
    </div>
  );
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
  onRetry?: () => void;
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
  onRetry,
  onClearError,
  homeSuggestions = EMPTY_SUGGESTIONS,
  browserAI,
  conversationClassName,
  inputClassName,
}: ChatPanelProps) {
  const [inputLength, setInputLength] = useState(0);
  const showToolCalls = usePreferencesStore((s) => s.showToolCalls);
  const showReasoning = usePreferencesStore((s) => s.showReasoning);
  const visibility = { showReasoning, showToolCalls };
  const waitStatus = getAssistantWaitStatus(status, messages, visibility);
  const showWait = waitStatus.placement !== "none";
  const lastMessageId = messages.at(-1)?.id;

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

  const handleRetry = () => {
    onRetry?.();
    handleScrollToBottom();
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInputLength(e.target.value.length);
    onClearError?.();
  };

  return (
    <>
      <Conversation
        stickyInstance={stickyInstance}
        aria-busy={status === "submitted" || status === "streaming"}
        className={cn(
          "min-h-0 flex-1 bg-popover/10 [&_[data-slot=scroll-area-content]]:flex [&_[data-slot=scroll-area-content]]:min-h-full [&_[data-slot=scroll-area-content]]:flex-col",
          conversationClassName,
        )}
      >
        <ConversationContent
          className={cn(
            messages.length === 0 && !showWait ? "items-center justify-center" : "gap-4 px-3 py-4",
          )}
        >
          {messages.length === 0 && !showWait ? (
            <ConversationEmptyState
              icon={<IconMessages className="size-7" aria-hidden />}
              title={`Ask me anything about ${domain ?? "domains"}!`}
              description="I can look up DNS records, WHOIS data, SSL certificates, and more — just say the word."
            />
          ) : (
            <>
              {messages.map((message) => {
                if (
                  message.role === "assistant" &&
                  !hasVisibleAssistantParts(message, visibility)
                ) {
                  return null;
                }

                const isLiveMessage =
                  message.id === lastMessageId &&
                  (status === "submitted" || status === "streaming");

                return (
                  <Message
                    key={message.id}
                    from={message.role}
                    className={
                      isLiveMessage
                        ? undefined
                        : "[contain-intrinsic-size:auto_5rem] [content-visibility:auto]"
                    }
                  >
                    <MessageContent>
                      {getAssistantRenderItems(message).map((item) => {
                        if (item.kind === "reasoning") {
                          if (!showReasoning) {
                            return null;
                          }
                          return (
                            <Reasoning
                              key={item.key}
                              className="w-full"
                              isStreaming={item.isStreaming}
                            >
                              <ReasoningTrigger />
                              <ReasoningContent>{item.text}</ReasoningContent>
                            </Reasoning>
                          );
                        }

                        const { key, part } = item;
                        if (isTextUIPart(part)) {
                          if (!part.text.trim()) {
                            return null;
                          }
                          return (
                            <MessageResponse
                              key={key}
                              caret={part.state === "streaming" ? "block" : undefined}
                            >
                              {part.text}
                            </MessageResponse>
                          );
                        }
                        if (isToolUIPart(part) && showToolCalls) {
                          const toolPart = part as ToolUIPart;
                          const statusType = getToolPartType(part) as ToolUIPart["type"];
                          return (
                            <Tool key={key} defaultOpen={toolPart.state === "output-error"}>
                              <ToolHeader
                                title={getDomainToolStatus(statusType)}
                                type={statusType}
                                state={toolPart.state}
                              />
                              <ToolContent>
                                <ToolInput input={toolPart.input} />
                                {(toolPart.state === "output-available" ||
                                  toolPart.state === "output-error") && (
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
                      {waitStatus.placement === "inline" &&
                      waitStatus.kind &&
                      message.id === lastMessageId ? (
                        <AssistantWaitIndicator kind={waitStatus.kind} />
                      ) : null}
                    </MessageContent>
                  </Message>
                );
              })}
              {waitStatus.placement === "standalone" && waitStatus.kind ? (
                <Message key="wait" from="assistant">
                  <MessageContent>
                    <AssistantWaitIndicator kind={waitStatus.kind} />
                  </MessageContent>
                </Message>
              ) : null}
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
        {messages.length === 0 && suggestions.length > 0 && (
          <Suggestions className="justify-center">
            {suggestions.map((suggestion) => (
              <Suggestion
                key={suggestion}
                suggestion={suggestion}
                onClick={handleSuggestionClick}
              />
            ))}
          </Suggestions>
        )}

        {error && (
          <div
            role="alert"
            className="flex items-center gap-2 rounded-md border border-destructive/15 bg-destructive/10 px-2 py-1.5 text-[13px] leading-tight text-destructive"
          >
            <IconAlertCircle className="size-4 shrink-0" aria-hidden />
            <span className="min-w-0 flex-1 break-words">{error}</span>
            <div className="flex shrink-0 items-center gap-1">
              {onRetry && (
                <Button
                  variant="ghost"
                  size="xs"
                  onClick={handleRetry}
                  className="text-destructive hover:!bg-destructive/20 hover:!text-destructive"
                >
                  <IconRefresh />
                  Retry
                </Button>
              )}
              {onClearError && (
                <Button
                  variant="ghost"
                  size="icon-xs"
                  onClick={onClearError}
                  aria-label="Dismiss error"
                  className="text-destructive hover:!bg-destructive/20 hover:!text-destructive"
                >
                  <IconX className="size-3" aria-hidden />
                </Button>
              )}
            </div>
          </div>
        )}

        <PromptInput onSubmit={handleSubmit}>
          <PromptInputTextarea
            placeholder={placeholder}
            aria-label={domain ? `Ask about ${domain}` : "Ask about a domain"}
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

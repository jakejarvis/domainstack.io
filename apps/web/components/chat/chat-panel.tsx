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
  type AssistantRenderItem,
  type AssistantWaitKind,
  type AssistantWaitStatus,
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
const LIVE_MESSAGE_STATUSES = new Set<ChatStatus>(["submitted", "streaming"]);

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
      <ShimmeringText text={isThinking ? "Thinking…" : "Working…"} startOnView={false} />
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

function ChatMessagePart({
  item,
  showReasoning,
  showToolCalls,
}: {
  item: AssistantRenderItem;
  showReasoning: boolean;
  showToolCalls: boolean;
}) {
  if (item.kind === "reasoning") {
    if (!showReasoning) {
      return null;
    }
    return (
      <Reasoning key={item.key} className="w-full" isStreaming={item.isStreaming}>
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
      <MessageResponse key={key} caret={part.state === "streaming" ? "block" : undefined}>
        {part.text}
      </MessageResponse>
    );
  }
  if (isToolUIPart(part) && showToolCalls) {
    const toolPart = part as ToolUIPart;
    const statusType = getToolPartType(part) as ToolUIPart["type"];
    const showOutput = toolPart.state === "output-available" || toolPart.state === "output-error";
    return (
      <Tool key={key} defaultOpen={toolPart.state === "output-error"}>
        <ToolHeader
          title={getDomainToolStatus(statusType)}
          type={statusType}
          state={toolPart.state}
        />
        <ToolContent>
          <ToolInput input={toolPart.input} />
          {showOutput ? (
            <ToolOutput output={toolPart.output} errorText={toolPart.errorText} />
          ) : null}
        </ToolContent>
      </Tool>
    );
  }
  return null;
}

function ChatMessage({
  message,
  lastMessageId,
  status,
  waitStatus,
  showReasoning,
  showToolCalls,
}: {
  message: UIMessage;
  lastMessageId: string | undefined;
  status: ChatStatus;
  waitStatus: AssistantWaitStatus;
  showReasoning: boolean;
  showToolCalls: boolean;
}) {
  const visibility = { showReasoning, showToolCalls };
  if (message.role === "assistant" && !hasVisibleAssistantParts(message, visibility)) {
    return null;
  }

  const isLiveMessage = message.id === lastMessageId && LIVE_MESSAGE_STATUSES.has(status);
  const showInlineWait =
    waitStatus.placement === "inline" && Boolean(waitStatus.kind) && message.id === lastMessageId;

  return (
    <Message
      from={message.role}
      className={
        isLiveMessage ? undefined : "[contain-intrinsic-size:auto_5rem] [content-visibility:auto]"
      }
    >
      <MessageContent>
        {getAssistantRenderItems(message).map((item) => (
          <ChatMessagePart
            key={item.key}
            item={item}
            showReasoning={showReasoning}
            showToolCalls={showToolCalls}
          />
        ))}
        {showInlineWait && waitStatus.kind ? (
          <AssistantWaitIndicator kind={waitStatus.kind} />
        ) : null}
      </MessageContent>
    </Message>
  );
}

function ChatMessageList({
  messages,
  domain,
  status,
  waitStatus,
  showWait,
  showReasoning,
  showToolCalls,
}: {
  messages: UIMessage[];
  domain?: string;
  status: ChatStatus;
  waitStatus: AssistantWaitStatus;
  showWait: boolean;
  showReasoning: boolean;
  showToolCalls: boolean;
}) {
  if (messages.length === 0 && !showWait) {
    return (
      <ConversationEmptyState
        icon={<IconMessages className="size-7" aria-hidden />}
        title={`Ask me anything about ${domain ?? "domains"}!`}
        description="I can look up DNS records, WHOIS data, SSL certificates, and more — just say the word."
      />
    );
  }

  const lastMessageId = messages.at(-1)?.id;

  return (
    <>
      {messages.map((message) => (
        <ChatMessage
          key={message.id}
          message={message}
          lastMessageId={lastMessageId}
          status={status}
          waitStatus={waitStatus}
          showReasoning={showReasoning}
          showToolCalls={showToolCalls}
        />
      ))}
      {waitStatus.placement === "standalone" && waitStatus.kind ? (
        <Message key="wait" from="assistant">
          <MessageContent>
            <AssistantWaitIndicator kind={waitStatus.kind} />
          </MessageContent>
        </Message>
      ) : null}
    </>
  );
}

function ChatErrorAlert({
  error,
  onRetry,
  onClearError,
}: {
  error: string;
  onRetry?: () => void;
  onClearError?: () => void;
}) {
  return (
    <div
      role="alert"
      className="flex items-center gap-2 rounded-md border border-destructive/15 bg-destructive/10 px-2 py-1.5 text-[13px] leading-tight text-destructive"
    >
      <IconAlertCircle className="size-4 shrink-0" aria-hidden />
      <span className="min-w-0 flex-1 break-words">{error}</span>
      <div className="flex shrink-0 items-center gap-1">
        {onRetry ? (
          <Button
            variant="ghost"
            size="xs"
            onClick={onRetry}
            className="text-destructive hover:!bg-destructive/20 hover:!text-destructive"
          >
            <IconRefresh />
            Retry
          </Button>
        ) : null}
        {onClearError ? (
          <Button
            variant="ghost"
            size="icon-xs"
            onClick={onClearError}
            aria-label="Dismiss error"
            className="text-destructive hover:!bg-destructive/20 hover:!text-destructive"
          >
            <IconX className="size-3" aria-hidden />
          </Button>
        ) : null}
      </div>
    </div>
  );
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
  const stickyInstance = useStickToBottom();
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

  const isEmpty = messages.length === 0 && !showWait;
  const isBusy = LIVE_MESSAGE_STATUSES.has(status);

  return (
    <>
      <Conversation
        stickyInstance={stickyInstance}
        aria-busy={isBusy}
        className={cn(
          "min-h-0 flex-1 bg-popover/10 [&_[data-slot=scroll-area-content]]:flex [&_[data-slot=scroll-area-content]]:min-h-full [&_[data-slot=scroll-area-content]]:flex-col",
          conversationClassName,
        )}
      >
        <ConversationContent
          className={cn(isEmpty ? "items-center justify-center" : "gap-4 px-3 py-4")}
        >
          <ChatMessageList
            messages={messages}
            domain={domain}
            status={status}
            waitStatus={waitStatus}
            showWait={showWait}
            showReasoning={showReasoning}
            showToolCalls={showToolCalls}
          />
        </ConversationContent>
        {stickyInstance.isNearBottom ? null : (
          <ConversationScrollButton onClick={handleScrollToBottom} />
        )}
      </Conversation>

      <div
        className={cn("shrink-0 space-y-3 border-t border-border bg-card/60 !pt-3", inputClassName)}
      >
        {messages.length === 0 && suggestions.length > 0 ? (
          <Suggestions className="justify-center">
            {suggestions.map((suggestion) => (
              <Suggestion
                key={suggestion}
                suggestion={suggestion}
                onClick={handleSuggestionClick}
              />
            ))}
          </Suggestions>
        ) : null}

        {error ? (
          <ChatErrorAlert
            error={error}
            onRetry={onRetry ? handleRetry : undefined}
            onClearError={onClearError}
          />
        ) : null}

        <PromptInput onSubmit={handleSubmit}>
          <PromptInputTextarea
            placeholder={domain ? `Ask about ${domain}\u2026` : "Ask about a domain\u2026"}
            aria-label={domain ? `Ask about ${domain}` : "Ask about a domain"}
            onChange={handleInputChange}
            maxLength={MAX_MESSAGE_LENGTH}
          />
          <PromptInputFooter className="pr-1.5 pb-1.5 pl-3">
            <PromptInputCharacterCount current={inputLength} max={MAX_MESSAGE_LENGTH} />
            <div className="flex items-center gap-2">
              <ChatModeSelector browserAI={browserAI} disabled={isBusy} />
              <PromptInputSubmit disabled={inputLength === 0} status={error ? "error" : status} />
            </div>
          </PromptInputFooter>
        </PromptInput>
      </div>
    </>
  );
}

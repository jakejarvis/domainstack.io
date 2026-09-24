"use client";

import {
  IconAlertCircle,
  IconArrowDown,
  IconBrain,
  IconMessages,
  IconRefresh,
  IconX,
} from "@tabler/icons-react";
import { type ChatStatus, isTextUIPart, isToolUIPart, type ToolUIPart, type UIMessage } from "ai";
import { memo, useCallback, useState } from "react";

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
import {
  MessageScrollerContent,
  MessageScrollerItem,
  MessageScrollerProvider,
  MessageScrollerRoot,
  MessageScrollerViewport,
  useMessageScroller,
  useMessageScrollerScrollable,
} from "@domainstack/ui/message-scroller";
import { Spinner } from "@domainstack/ui/spinner";
import { cn } from "@domainstack/ui/utils";

import { ChatModeSelector } from "./chat-mode-selector";
import { Message, MessageContent, MessageResponse } from "./elements/message";
import {
  PromptInput,
  PromptInputCharacterCount,
  PromptInputFooter,
  PromptInputSubmit,
  PromptInputTextarea,
} from "./elements/prompt-input";
import { Reasoning, ReasoningContent, ReasoningTrigger } from "./elements/reasoning";
import { Suggestion, Suggestions } from "./elements/suggestion";
import { Tool, ToolContent, ToolHeader, ToolInput, ToolOutput } from "./elements/tool";

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
      <span className="shimmer">{isThinking ? "Thinking…" : "Working…"}</span>
    </div>
  );
}

function ChatEmptyState({
  icon,
  title,
  description,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
}) {
  return (
    <div className="flex size-full flex-col items-center justify-center gap-4 px-6 py-3 text-center">
      <div className="text-muted-foreground">{icon}</div>
      <div className="space-y-1">
        <h3 className="text-sm font-medium text-pretty break-words">{title}</h3>
        <p className="text-[13px] leading-normal text-pretty text-muted-foreground">
          {description}
        </p>
      </div>
    </div>
  );
}

function ScrollToBottomButton({ onClick }: { onClick: () => void }) {
  return (
    <Button
      aria-label="Scroll to bottom"
      className="absolute bottom-4 left-1/2 z-10 -translate-x-1/2 rounded-full bg-background/80 shadow-md backdrop-blur-sm"
      size="icon"
      variant="outline"
      onClick={onClick}
    >
      <IconArrowDown className="size-4" />
    </Button>
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
    const hasThoughts = item.text.trim().length > 0;
    return (
      <Reasoning
        key={item.key}
        className="w-full"
        isStreaming={item.isStreaming}
        hasContent={hasThoughts}
      >
        <ReasoningTrigger />
        {hasThoughts ? <ReasoningContent>{item.text}</ReasoningContent> : null}
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

interface ChatMessageProps {
  message: UIMessage;
  lastMessageId: string | undefined;
  status: ChatStatus;
  waitStatus: AssistantWaitStatus;
  showReasoning: boolean;
  showToolCalls: boolean;
}

// Historical messages never change once streamed, so only the message
// currently being streamed (`lastMessageId`) needs to react to `status`/
// `waitStatus` — re-rendering every message on every streamed token turns an
// O(1) update into an O(conversation length) one.
function chatMessagePropsAreEqual(prev: ChatMessageProps, next: ChatMessageProps): boolean {
  if (
    prev.message !== next.message ||
    prev.showReasoning !== next.showReasoning ||
    prev.showToolCalls !== next.showToolCalls
  ) {
    return false;
  }
  const isLast = next.message.id === next.lastMessageId;
  if (isLast !== (prev.message.id === prev.lastMessageId)) {
    return false;
  }
  if (!isLast) {
    return true;
  }
  return (
    prev.status === next.status &&
    prev.waitStatus.placement === next.waitStatus.placement &&
    prev.waitStatus.kind === next.waitStatus.kind
  );
}

const ChatMessage = memo(function ChatMessage({
  message,
  lastMessageId,
  status,
  waitStatus,
  showReasoning,
  showToolCalls,
}: ChatMessageProps) {
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
}, chatMessagePropsAreEqual);

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
      <ChatEmptyState
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
        <MessageScrollerItem
          key={message.id}
          messageId={message.id}
          scrollAnchor={message.role === "user"}
        >
          <ChatMessage
            message={message}
            lastMessageId={lastMessageId}
            status={status}
            waitStatus={waitStatus}
            showReasoning={showReasoning}
            showToolCalls={showToolCalls}
          />
        </MessageScrollerItem>
      ))}
      {waitStatus.placement === "standalone" && waitStatus.kind ? (
        <MessageScrollerItem messageId="wait-indicator">
          <Message key="wait" from="assistant">
            <MessageContent>
              <AssistantWaitIndicator kind={waitStatus.kind} />
            </MessageContent>
          </Message>
        </MessageScrollerItem>
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
  onRetry: () => void;
  onClearError: () => void;
}) {
  return (
    <div
      role="alert"
      className="flex items-center gap-2 rounded-md border border-destructive/15 bg-destructive/10 px-2 py-1.5 text-[13px] leading-tight text-destructive"
    >
      <IconAlertCircle className="size-4 shrink-0" aria-hidden />
      <span className="min-w-0 flex-1 break-words">{error}</span>
      <div className="flex shrink-0 items-center gap-1">
        <Button
          variant="ghost"
          size="xs"
          onClick={onRetry}
          className="text-destructive hover:!bg-destructive/20 hover:!text-destructive"
        >
          <IconRefresh />
          Retry
        </Button>
        <Button
          variant="ghost"
          size="icon-xs"
          onClick={onClearError}
          aria-label="Dismiss error"
          className="text-destructive hover:!bg-destructive/20 hover:!text-destructive"
        >
          <IconX className="size-3" aria-hidden />
        </Button>
      </div>
    </div>
  );
}

/** A chat conversation as the panel drives it, from either the cloud or local session. */
export interface ChatController {
  messages: UIMessage[];
  status: ChatStatus;
  /** User-facing message; null while a response is in flight. */
  error: string | null;
  sendMessage: (params: { text: string }) => void;
  clearMessages: () => void;
  retry: () => void;
  clearError: () => void;
}

interface ChatPanelProps {
  chat: ChatController;
  domain?: string;
  homeSuggestions?: string[];
  browserAI: UseBrowserAIResult;
  conversationClassName?: string;
  inputClassName?: string;
}

export function ChatPanel(props: ChatPanelProps) {
  return (
    <MessageScrollerProvider autoScroll defaultScrollPosition="end" scrollEdgeThreshold={48}>
      <ChatPanelBody {...props} />
    </MessageScrollerProvider>
  );
}

function ChatPanelBody({
  chat,
  domain,
  homeSuggestions = EMPTY_SUGGESTIONS,
  browserAI,
  conversationClassName,
  inputClassName,
}: ChatPanelProps) {
  const { messages, status, error, sendMessage, clearMessages, clearError } = chat;
  const [inputLength, setInputLength] = useState(0);
  const showToolCalls = usePreferencesStore((s) => s.showToolCalls);
  const showReasoning = usePreferencesStore((s) => s.showReasoning);
  const visibility = { showReasoning, showToolCalls };
  const waitStatus = getAssistantWaitStatus(status, messages, visibility);
  const showWait = waitStatus.placement !== "none";
  const suggestions = domain ? getReportSuggestions(domain) : homeSuggestions;

  const { scrollToEnd } = useMessageScroller();
  const scrollable = useMessageScrollerScrollable();
  const handleScrollToBottom = useCallback(() => {
    scrollToEnd({ behavior: "smooth" });
  }, [scrollToEnd]);

  const handleSubmit = (message: { text: string }) => {
    sendMessage(message);
    setInputLength(0);
  };

  const handleSuggestionClick = (suggestion: string) => {
    clearMessages();
    clearError();
    sendMessage({ text: suggestion });
  };

  const handleRetry = () => {
    chat.retry();
    scrollToEnd({ behavior: "smooth" });
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInputLength(e.target.value.length);
    clearError();
  };

  const isEmpty = messages.length === 0 && !showWait;
  const isBusy = LIVE_MESSAGE_STATUSES.has(status);

  return (
    <>
      <MessageScrollerRoot
        aria-busy={isBusy}
        className={cn("min-h-0 flex-1 bg-popover/10", conversationClassName)}
        data-base-ui-swipe-ignore
      >
        <MessageScrollerViewport>
          <MessageScrollerContent
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
          </MessageScrollerContent>
        </MessageScrollerViewport>
        {scrollable.end ? <ScrollToBottomButton onClick={handleScrollToBottom} /> : null}
      </MessageScrollerRoot>

      <div
        className={cn("shrink-0 space-y-3 border-t border-border bg-card/60 !pt-3", inputClassName)}
      >
        {messages.length === 0 && suggestions.length > 0 ? (
          <Suggestions className="justify-center" data-base-ui-swipe-ignore>
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
          <ChatErrorAlert error={error} onRetry={handleRetry} onClearError={clearError} />
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

"use client";

import { useChat } from "@ai-sdk/react";
import { WorkflowChatTransport } from "@ai-sdk/workflow/client";
import type { UIMessage } from "ai";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { BetaBadge } from "@/components/beta-badge";
import { type UseBrowserAIResult, useBrowserAI } from "@/hooks/use-browser-ai";
import { useChatPersistence } from "@/hooks/use-chat-persistence";
import { useLocalChat } from "@/hooks/use-local-chat";
import { useIsMobile } from "@/hooks/use-mobile";
import { analytics } from "@/lib/analytics/client";
import { createClientDomainTools } from "@/lib/chat/client-tools";
import { buildClientSystemPrompt } from "@/lib/chat/system-prompt";
import { trimChatHistory } from "@/lib/chat/trim-history";
import type { DomainChatUIMessage } from "@/lib/chat/ui-message";
import { safeDecodeURIComponent } from "@/lib/safe-parse";
import { useChatHydrated, useChatStore } from "@/lib/stores/chat-store";
import { type ChatMode, usePreferencesStore } from "@/lib/stores/preferences-store";
import { useTRPCClient } from "@/lib/trpc/client";
import { CHAT_STALL_TIMEOUT_MS } from "@domainstack/constants";
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from "@domainstack/ui/drawer";

import { ChatHeaderActions } from "./chat-header-actions";
import { ChatPanel } from "./chat-panel";
import { ChatSettingsDialog } from "./chat-settings-dialog";
import { getUserFriendlyError } from "./utils";

interface ChatClientProps {
  suggestions?: string[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onReady: () => void;
}

const EMPTY_SUGGESTIONS: string[] = [];

interface ChatController {
  messages: UIMessage[];
  sendMessage: (params: { text: string }) => void;
  clearMessages: () => void;
  retry: () => void;
  clearError: () => void;
  status: "submitted" | "streaming" | "ready" | "error";
  error: string | null;
}

export function ChatClient({
  suggestions = EMPTY_SUGGESTIONS,
  open,
  onOpenChange,
  onReady,
}: ChatClientProps) {
  const [settingsOpen, setSettingsOpen] = useState(false);
  const params = useParams<{ domain?: string }>();
  const aiMode = usePreferencesStore((s) => s.aiMode);
  const browserAI = useBrowserAI();
  const chatHydrated = useChatHydrated();
  const storedMessageCount = useChatStore((s) => s.messages.length);

  useEffect(() => {
    if (chatHydrated) onReady();
  }, [chatHydrated, onReady]);

  const domain = params.domain ? safeDecodeURIComponent(params.domain) : undefined;

  const wantsLocal = (aiMode === "local" || aiMode === "auto") && browserAI.status === "ready";
  const preferredMode: ChatMode =
    chatHydrated && storedMessageCount > 0 ? "cloud" : wantsLocal ? "local" : "cloud";

  const [lockedMode, setLockedMode] = useState<ChatMode | null>(null);
  const mode = lockedMode ?? preferredMode;

  const handleActiveChange = useCallback(
    (active: boolean) => {
      setLockedMode((prev) => {
        if (active) return prev ?? preferredMode;
        return null;
      });
    },
    [preferredMode],
  );

  if (!chatHydrated) return null;

  return mode === "local" ? (
    <LocalChatSession
      domain={domain}
      suggestions={suggestions}
      model={browserAI.model}
      browserAI={browserAI}
      open={open}
      onOpenChange={onOpenChange}
      settingsOpen={settingsOpen}
      onSettingsOpenChange={setSettingsOpen}
      onActiveChange={handleActiveChange}
    />
  ) : (
    <CloudChatSession
      domain={domain}
      suggestions={suggestions}
      browserAI={browserAI}
      open={open}
      onOpenChange={onOpenChange}
      settingsOpen={settingsOpen}
      onSettingsOpenChange={setSettingsOpen}
      onActiveChange={handleActiveChange}
    />
  );
}

interface ChatSessionProps {
  domain?: string;
  suggestions: string[];
  browserAI: UseBrowserAIResult;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  settingsOpen: boolean;
  onSettingsOpenChange: (open: boolean) => void;
  onActiveChange: (active: boolean) => void;
}

function CloudChatSession({
  domain,
  suggestions,
  browserAI,
  open,
  onOpenChange,
  settingsOpen,
  onSettingsOpenChange,
  onActiveChange,
}: ChatSessionProps) {
  const domainRef = useRef(domain);
  useEffect(() => {
    domainRef.current = domain;
  });

  const runId = useChatStore((s) => s.runId);
  const runIdRef = useRef(runId);
  useEffect(() => {
    runIdRef.current = runId;
  });
  // Capture initial runId for resume — must stay stable so AI SDK does not
  // restart resumption when onChatEnd later clears the live run ID.
  const [initialRunId] = useState(runId);
  const storedMessages = useChatStore((s) => s.messages);
  const [initialMessages] = useState(storedMessages);
  const setRunId = useChatStore((s) => s.setRunId);
  const setStoredMessages = useChatStore((s) => s.setMessages);
  const clearSession = useChatStore((s) => s.clearSession);
  const ensureSessionId = useChatStore((s) => s.ensureSessionId);

  const transport = useMemo(
    () =>
      // oxlint-disable-next-line react/refs -- transport callbacks read latest domain/runId from refs after render
      new WorkflowChatTransport({
        api: "/api/chat",
        prepareSendMessagesRequest: ({ messages }) => ({
          body: {
            messages: trimChatHistory(messages),
            domain: domainRef.current,
            sessionId: ensureSessionId(),
          },
        }),
        prepareReconnectToStreamRequest: ({ api: _api, ...rest }) => {
          const currentRunId = runIdRef.current;
          if (!currentRunId) {
            throw new Error("No active workflow run ID found");
          }
          return {
            ...rest,
            api: `/api/chat/${encodeURIComponent(currentRunId)}/stream`,
          };
        },
        onChatSendMessage: (response, options) => {
          setStoredMessages(options.messages);
          const workflowRunId = response.headers.get("x-workflow-run-id");
          if (workflowRunId) {
            setRunId(workflowRunId);
          }
        },
        onChatEnd: () => {
          setRunId(null);
        },
      }),
    [setStoredMessages, setRunId, ensureSessionId],
  );

  const chat = useChat<DomainChatUIMessage>({
    transport,
    messages: initialMessages as DomainChatUIMessage[],
    resume: !!initialRunId,
    onError: (error) => {
      analytics.trackException(error, { context: "chat-send", domain });
    },
  });

  useChatPersistence({
    messages: chat.messages,
    status: chat.status,
  });

  const { stop, status } = chat;
  const isBusy = status === "submitted" || status === "streaming";

  // Watchdog: abort if no chunk arrives for CHAT_STALL_TIMEOUT_MS. Each chunk
  // produces a new `messages` array, which restarts the timer.
  const [stalled, setStalled] = useState(false);
  useEffect(() => {
    if (!isBusy) return;
    const timer = setTimeout(() => {
      void stop();
      setStalled(true);
      analytics.trackException(new Error("Chat stream timed out"), {
        context: "chat-stall",
        domain: domainRef.current,
      });
    }, CHAT_STALL_TIMEOUT_MS);
    return () => clearTimeout(timer);
    // oxlint-disable-next-line react/exhaustive-effect-dependencies -- messages is a restart trigger, not a value read by the effect
  }, [isBusy, stop, chat.messages]);

  const clearMessages = useCallback(() => {
    // Abort the in-flight request first: otherwise the transport keeps
    // streaming (or reconnecting) into the message list we're about to empty,
    // and status stays "submitted"/"streaming".
    void stop();
    chat.setMessages([]);
    clearSession();
    setStalled(false);
    onActiveChange(false);
  }, [chat, stop, clearSession, onActiveChange]);

  const sendMessage = useCallback(
    (msgParams: { text: string }) => {
      const text = msgParams.text.trim();
      if (!text) return;
      setStalled(false);
      void chat.sendMessage({ text });
      onActiveChange(true);
    },
    [chat, onActiveChange],
  );

  const retry = useCallback(() => {
    setStalled(false);
    void chat.regenerate();
  }, [chat]);

  const clearError = useCallback(() => {
    setStalled(false);
    chat.clearError();
  }, [chat]);

  const error = isBusy
    ? null
    : chat.error
      ? getUserFriendlyError(chat.error)
      : stalled
        ? getUserFriendlyError(new Error("Chat stream timed out"))
        : null;

  return (
    <ChatShell
      chat={{
        messages: chat.messages,
        sendMessage,
        clearMessages,
        retry,
        clearError,
        status: chat.status,
        error,
      }}
      domain={domain}
      suggestions={suggestions}
      browserAI={browserAI}
      open={open}
      onOpenChange={onOpenChange}
      settingsOpen={settingsOpen}
      onSettingsOpenChange={onSettingsOpenChange}
    />
  );
}

function LocalChatSession({
  domain,
  suggestions,
  model,
  browserAI,
  open,
  onOpenChange,
  settingsOpen,
  onSettingsOpenChange,
  onActiveChange,
}: ChatSessionProps & { model: UseBrowserAIResult["model"] }) {
  const trpcClient = useTRPCClient();
  const clientTools = useMemo(() => createClientDomainTools(trpcClient), [trpcClient]);
  const systemPrompt = useMemo(() => buildClientSystemPrompt(domain), [domain]);

  const chat = useLocalChat({
    model,
    tools: clientTools,
    systemPrompt,
    onError: (error) => {
      analytics.trackException(error, { context: "local-chat-send", domain });
    },
  });

  const { stop: stopLocal } = chat;
  const clearMessages = useCallback(() => {
    stopLocal();
    chat.setMessages([]);
    onActiveChange(false);
  }, [chat, stopLocal, onActiveChange]);

  const sendMessage = useCallback(
    (msgParams: { text: string }) => {
      const text = msgParams.text.trim();
      if (!text) return;
      chat.sendMessage({ text });
      onActiveChange(true);
    },
    [chat, onActiveChange],
  );

  const retry = useCallback(() => {
    chat.regenerate();
  }, [chat]);

  const error =
    chat.status === "submitted" || chat.status === "streaming"
      ? null
      : chat.error
        ? getUserFriendlyError(chat.error)
        : null;

  return (
    <ChatShell
      chat={{
        messages: chat.messages,
        sendMessage,
        clearMessages,
        retry,
        clearError: chat.clearError,
        status: chat.status,
        error,
      }}
      domain={domain}
      suggestions={suggestions}
      browserAI={browserAI}
      open={open}
      onOpenChange={onOpenChange}
      settingsOpen={settingsOpen}
      onSettingsOpenChange={onSettingsOpenChange}
    />
  );
}

function ChatShell({
  chat,
  domain,
  suggestions,
  browserAI,
  open,
  onOpenChange,
  settingsOpen,
  onSettingsOpenChange,
}: {
  chat: ChatController;
  domain?: string;
  suggestions: string[];
  browserAI: UseBrowserAIResult;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  settingsOpen: boolean;
  onSettingsOpenChange: (open: boolean) => void;
}) {
  const isMobile = useIsMobile();

  const handleOpenChange = (nextOpen: boolean) => {
    if (!nextOpen) {
      onSettingsOpenChange(false);
    }
    onOpenChange(nextOpen);
  };

  return (
    <Drawer
      open={open}
      onOpenChange={handleOpenChange}
      swipeDirection={isMobile ? "down" : "right"}
    >
      <DrawerContent className="data-[swipe-direction=down]:mt-0 data-[swipe-direction=down]:h-[calc(100%---spacing(16))] data-[swipe-direction=down]:max-h-[calc(100%---spacing(16))]">
        <DrawerHeader className="flex-row items-center justify-between group-data-[swipe-direction=right]/drawer-content:border-b group-data-[swipe-direction=right]/drawer-content:bg-card/60 group-data-[swipe-direction=right]/drawer-content:px-3.5 group-data-[swipe-direction=right]/drawer-content:py-2">
          <DrawerTitle className="flex items-center gap-2">
            <span className="text-[15px] leading-none font-semibold tracking-tight">Ask AI</span>
            <BetaBadge />
          </DrawerTitle>
          <div className="flex items-center gap-2 group-data-[swipe-direction=right]/drawer-content:-mr-1.5 group-data-[swipe-direction=right]/drawer-content:gap-1.5">
            <ChatHeaderActions
              messages={chat.messages}
              onClear={chat.clearMessages}
              onSettingsClick={() => onSettingsOpenChange(true)}
              onCloseClick={() => handleOpenChange(false)}
            />
          </div>
        </DrawerHeader>
        <ChatPanel
          messages={chat.messages}
          sendMessage={chat.sendMessage}
          clearMessages={chat.clearMessages}
          status={chat.status}
          error={chat.error}
          onRetry={chat.retry}
          onClearError={chat.clearError}
          domain={domain}
          homeSuggestions={suggestions}
          browserAI={browserAI}
          conversationClassName="px-4 md:px-0"
          inputClassName="p-4 md:p-3"
        />
      </DrawerContent>
      <ChatSettingsDialog open={settingsOpen} onOpenChange={onSettingsOpenChange} />
    </Drawer>
  );
}

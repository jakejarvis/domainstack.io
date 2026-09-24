"use client";

import { useChat } from "@ai-sdk/react";
import { WorkflowChatTransport } from "@ai-sdk/workflow/client";
import type { ChatStatus, UIMessage } from "ai";
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
import { type ChatController, ChatPanel, LIVE_MESSAGE_STATUSES } from "./chat-panel";
import { ChatSettingsDialog } from "./chat-settings-dialog";
import { getUserFriendlyError } from "./utils";

interface ChatClientProps {
  suggestions?: string[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onReady: () => void;
}

const EMPTY_SUGGESTIONS: string[] = [];

/**
 * What a cloud or local chat session hands to the shell. `ChatShell` applies the
 * rules both share: trimming input, tracking whether a conversation is active,
 * and hiding errors while a response is in flight.
 */
interface ChatSession {
  messages: UIMessage[];
  status: ChatStatus;
  error: Error | null;
  send: (text: string) => void;
  clear: () => void;
  retry: () => void;
  clearError: () => void;
}

type RenderShell = (session: ChatSession) => React.ReactNode;

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

  const renderShell: RenderShell = (session) => (
    <ChatShell
      session={session}
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

  return mode === "local" ? (
    <LocalChatSession domain={domain} model={browserAI.model}>
      {renderShell}
    </LocalChatSession>
  ) : (
    <CloudChatSession domain={domain}>{renderShell}</CloudChatSession>
  );
}

const STALL_ERROR = new Error("Chat stream timed out");

function CloudChatSession({ domain, children }: { domain?: string; children: RenderShell }) {
  const domainRef = useRef(domain);
  useEffect(() => {
    domainRef.current = domain;
  });

  // Snapshot the persisted session once: resume must keep using the initial run id even
  // after onChatEnd clears it, and the live messages belong to useChat from here on.
  const [initial] = useState(() => {
    const { runId, messages } = useChatStore.getState();
    return { runId, messages: messages as DomainChatUIMessage[] };
  });

  const [transport] = useState(
    // oxlint-disable-next-line react/refs -- transport callbacks read the latest domain from a ref after render
    () =>
      new WorkflowChatTransport({
        api: "/api/chat",
        prepareSendMessagesRequest: ({ messages }) => ({
          body: {
            messages: trimChatHistory(messages),
            domain: domainRef.current,
            sessionId: useChatStore.getState().ensureSessionId(),
          },
        }),
        prepareReconnectToStreamRequest: ({ api: _api, ...rest }) => {
          const { runId } = useChatStore.getState();
          if (!runId) {
            throw new Error("No active workflow run ID found");
          }
          return {
            ...rest,
            api: `/api/chat/${encodeURIComponent(runId)}/stream`,
          };
        },
        onChatSendMessage: (response, options) => {
          const store = useChatStore.getState();
          store.setMessages(options.messages);
          const workflowRunId = response.headers.get("x-workflow-run-id");
          if (workflowRunId) {
            store.setRunId(workflowRunId);
          }
        },
        onChatEnd: () => {
          useChatStore.getState().setRunId(null);
        },
      }),
  );

  const chat = useChat<DomainChatUIMessage>({
    transport,
    messages: initial.messages,
    resume: !!initial.runId,
    onError: (error) => {
      analytics.trackException(error, { context: "chat-send", domain });
    },
  });

  useChatPersistence({
    messages: chat.messages,
    status: chat.status,
  });

  const { stop, status } = chat;
  const isBusy = LIVE_MESSAGE_STATUSES.has(status);

  // Watchdog: abort if no chunk arrives for CHAT_STALL_TIMEOUT_MS. Each chunk
  // produces a new `messages` array, which restarts the timer.
  const [stalled, setStalled] = useState(false);
  useEffect(() => {
    if (!isBusy) return;
    const timer = setTimeout(() => {
      void stop();
      setStalled(true);
      analytics.trackException(STALL_ERROR, {
        context: "chat-stall",
        domain: domainRef.current,
      });
    }, CHAT_STALL_TIMEOUT_MS);
    return () => clearTimeout(timer);
    // oxlint-disable-next-line react/exhaustive-effect-dependencies -- messages is a restart trigger, not a value read by the effect
  }, [isBusy, stop, chat.messages]);

  return children({
    messages: chat.messages,
    status,
    error: chat.error ?? (stalled ? STALL_ERROR : null),
    send: (text) => {
      setStalled(false);
      void chat.sendMessage({ text });
    },
    clear: () => {
      // Abort the in-flight request first: otherwise the transport keeps
      // streaming (or reconnecting) into the message list we're about to empty,
      // and status stays "submitted"/"streaming".
      void stop();
      chat.setMessages([]);
      useChatStore.getState().clearSession();
      setStalled(false);
    },
    retry: () => {
      setStalled(false);
      void chat.regenerate();
    },
    clearError: () => {
      setStalled(false);
      chat.clearError();
    },
  });
}

function LocalChatSession({
  domain,
  model,
  children,
}: {
  domain?: string;
  model: UseBrowserAIResult["model"];
  children: RenderShell;
}) {
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

  return children({
    messages: chat.messages,
    status: chat.status,
    error: chat.error,
    send: (text) => chat.sendMessage({ text }),
    clear: () => {
      chat.stop();
      chat.setMessages([]);
    },
    retry: chat.regenerate,
    clearError: chat.clearError,
  });
}

function ChatShell({
  session,
  domain,
  suggestions,
  browserAI,
  open,
  onOpenChange,
  settingsOpen,
  onSettingsOpenChange,
  onActiveChange,
}: {
  session: ChatSession;
  domain?: string;
  suggestions: string[];
  browserAI: UseBrowserAIResult;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  settingsOpen: boolean;
  onSettingsOpenChange: (open: boolean) => void;
  onActiveChange: (active: boolean) => void;
}) {
  const isMobile = useIsMobile();
  const isBusy = LIVE_MESSAGE_STATUSES.has(session.status);

  const chat: ChatController = {
    messages: session.messages,
    status: session.status,
    error: !isBusy && session.error ? getUserFriendlyError(session.error) : null,
    sendMessage: ({ text }) => {
      const trimmed = text.trim();
      if (!trimmed) return;
      session.send(trimmed);
      onActiveChange(true);
    },
    clearMessages: () => {
      session.clear();
      onActiveChange(false);
    },
    retry: session.retry,
    clearError: session.clearError,
  };

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
          chat={chat}
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

"use client";

import { useChat } from "@ai-sdk/react";
import { WorkflowChatTransport } from "@ai-sdk/workflow";
import { IconLayoutSidebarRightCollapse, IconLego } from "@tabler/icons-react";
import type { UIMessage } from "ai";
import { useAtom } from "jotai";
import { AnimatePresence } from "motion/react";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { BetaBadge } from "@/components/beta-badge";
import { useHaptics } from "@/components/providers/haptics-provider";
import { type UseBrowserAIResult, useBrowserAI } from "@/hooks/use-browser-ai";
import { useChatPersistence } from "@/hooks/use-chat-persistence";
import { useLocalChat } from "@/hooks/use-local-chat";
import { useIsMobile } from "@/hooks/use-mobile";
import { analytics } from "@/lib/analytics/client";
import { chatOpenAtom } from "@/lib/atoms/chat-atoms";
import { buildClientSystemPrompt } from "@/lib/chat/client-prompt";
import { createClientDomainTools } from "@/lib/chat/client-tools";
import { useChatHydrated, useChatStore } from "@/lib/stores/chat-store";
import { usePreferencesStore } from "@/lib/stores/preferences-store";
import { useTRPCClient } from "@/lib/trpc/client";
import { CHATBOT_NAME } from "@domainstack/constants";
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from "@domainstack/ui/drawer";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@domainstack/ui/sheet";

import { ChatFab } from "./chat-fab";
import { ChatHeaderActions } from "./chat-header-actions";
import { ChatPanel } from "./chat-panel";
import { ChatSettingsDialog } from "./chat-settings-dialog";
import { getUserFriendlyError } from "./utils";

interface ChatClientProps {
  suggestions?: string[];
}

const EMPTY_SUGGESTIONS: string[] = [];

type ChatMode = "cloud" | "local";

interface ChatController {
  messages: UIMessage[];
  sendMessage: (params: { text: string }) => void;
  clearMessages: () => void;
  status: "submitted" | "streaming" | "ready" | "error";
  error: string | null;
}

export function ChatClient({ suggestions = EMPTY_SUGGESTIONS }: ChatClientProps) {
  const [open, setOpen] = useAtom(chatOpenAtom);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const params = useParams<{ domain?: string }>();
  const isMobile = useIsMobile();
  const hideAiFeatures = usePreferencesStore((s) => s.hideAiFeatures);
  const aiMode = usePreferencesStore((s) => s.aiMode);
  const browserAI = useBrowserAI();
  const chatHydrated = useChatHydrated();
  const storedMessageCount = useChatStore((s) => s.messages.length);
  const { trigger } = useHaptics();

  const domain = params.domain ? decodeURIComponent(params.domain) : undefined;

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

  const handleChatClick = () => {
    void trigger("medium");
    setOpen(!open);
  };

  const handleSettingsClick = () => {
    setOpen(false);
    setSettingsOpen(true);
  };

  if (hideAiFeatures && !settingsOpen) {
    return null;
  }

  return (
    <>
      <AnimatePresence>{!hideAiFeatures && <ChatFab onClick={handleChatClick} />}</AnimatePresence>

      {chatHydrated &&
        (mode === "local" ? (
          <LocalChatSession
            domain={domain}
            suggestions={suggestions}
            model={browserAI.model}
            browserAI={browserAI}
            isMobile={isMobile}
            open={open}
            onOpenChange={setOpen}
            onSettingsClick={handleSettingsClick}
            onActiveChange={handleActiveChange}
          />
        ) : (
          <CloudChatSession
            domain={domain}
            suggestions={suggestions}
            browserAI={browserAI}
            isMobile={isMobile}
            open={open}
            onOpenChange={setOpen}
            onSettingsClick={handleSettingsClick}
            onActiveChange={handleActiveChange}
          />
        ))}

      <ChatSettingsDialog open={settingsOpen} onOpenChange={setSettingsOpen} />
    </>
  );
}

interface ChatSessionProps {
  domain?: string;
  suggestions: string[];
  browserAI: UseBrowserAIResult;
  isMobile: boolean;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSettingsClick: () => void;
  onActiveChange: (active: boolean) => void;
}

function CloudChatSession({
  domain,
  suggestions,
  browserAI,
  isMobile,
  open,
  onOpenChange,
  onSettingsClick,
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
  const setRunId = useChatStore((s) => s.setRunId);
  const setStoredMessages = useChatStore((s) => s.setMessages);
  const clearSession = useChatStore((s) => s.clearSession);

  const transport = useMemo(
    () =>
      // oxlint-disable-next-line react/refs -- transport callbacks read latest domain/runId from refs after render
      new WorkflowChatTransport({
        api: "/api/chat",
        prepareSendMessagesRequest: ({ messages }) => ({
          body: { messages, domain: domainRef.current },
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
    [setStoredMessages, setRunId],
  );

  const chat = useChat({
    transport,
    resume: !!initialRunId,
    onError: (error) => {
      analytics.trackException(error, { context: "chat-send", domain });
    },
  });

  useChatPersistence({
    messages: chat.messages,
    status: chat.status,
    setMessages: chat.setMessages,
  });

  const clearMessages = useCallback(() => {
    chat.setMessages([]);
    clearSession();
  }, [chat, clearSession]);

  const sendMessage = useCallback(
    (msgParams: { text: string }) => {
      const text = msgParams.text.trim();
      if (!text) return;
      chat.sendMessage({ text });
    },
    [chat],
  );

  const error =
    chat.status === "streaming" ? null : chat.error ? getUserFriendlyError(chat.error) : null;

  useEffect(() => {
    onActiveChange(chat.messages.length > 0);
  }, [chat.messages.length, onActiveChange]);

  return (
    <ChatShell
      chat={{
        messages: chat.messages,
        sendMessage,
        clearMessages,
        status: chat.status,
        error,
      }}
      domain={domain}
      suggestions={suggestions}
      browserAI={browserAI}
      isMobile={isMobile}
      open={open}
      onOpenChange={onOpenChange}
      onSettingsClick={onSettingsClick}
    />
  );
}

function LocalChatSession({
  domain,
  suggestions,
  model,
  browserAI,
  isMobile,
  open,
  onOpenChange,
  onSettingsClick,
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

  const clearMessages = useCallback(() => {
    chat.setMessages([]);
  }, [chat]);

  const sendMessage = useCallback(
    (msgParams: { text: string }) => {
      const text = msgParams.text.trim();
      if (!text) return;
      chat.sendMessage({ text });
    },
    [chat],
  );

  const error =
    chat.status === "streaming" ? null : chat.error ? getUserFriendlyError(chat.error) : null;

  useEffect(() => {
    onActiveChange(chat.messages.length > 0);
  }, [chat.messages.length, onActiveChange]);

  return (
    <ChatShell
      chat={{
        messages: chat.messages,
        sendMessage,
        clearMessages,
        status: chat.status,
        error,
      }}
      domain={domain}
      suggestions={suggestions}
      browserAI={browserAI}
      isMobile={isMobile}
      open={open}
      onOpenChange={onOpenChange}
      onSettingsClick={onSettingsClick}
    />
  );
}

function ChatShell({
  chat,
  domain,
  suggestions,
  browserAI,
  isMobile,
  open,
  onOpenChange,
  onSettingsClick,
}: {
  chat: ChatController;
  domain?: string;
  suggestions: string[];
  browserAI: UseBrowserAIResult;
  isMobile: boolean;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSettingsClick: () => void;
}) {
  const headerActions = (
    <ChatHeaderActions
      messages={chat.messages}
      onClear={chat.clearMessages}
      onSettingsClick={onSettingsClick}
      onCloseClick={() => onOpenChange(false)}
      closeIcon={isMobile ? undefined : IconLayoutSidebarRightCollapse}
    />
  );

  const panel = (
    <ChatPanel
      {...chat}
      domain={domain}
      homeSuggestions={suggestions}
      browserAI={browserAI}
      conversationClassName={isMobile ? "px-4" : undefined}
      inputClassName={isMobile ? "p-4" : "p-3"}
    />
  );

  if (isMobile) {
    return (
      <Drawer open={open} onOpenChange={onOpenChange}>
        <DrawerContent>
          <DrawerHeader className="flex flex-row items-center justify-between">
            <DrawerTitle className="flex items-center gap-2">
              <IconLego className="size-4" />
              <span className="text-[15px] leading-none font-semibold tracking-tight">
                {CHATBOT_NAME}
              </span>
              <BetaBadge />
            </DrawerTitle>
            <div className="flex items-center gap-2">{headerActions}</div>
          </DrawerHeader>
          {panel}
        </DrawerContent>
      </Drawer>
    );
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="flex w-[420px] flex-col gap-0 p-0"
        showCloseButton={false}
      >
        <SheetHeader className="flex shrink-0 flex-row items-center justify-between border-b bg-card/60 px-3.5 py-2">
          <SheetTitle className="flex items-center gap-2">
            <IconLego className="size-4" />
            <span className="text-[15px] leading-none font-semibold tracking-tight">
              {CHATBOT_NAME}
            </span>
            <BetaBadge />
          </SheetTitle>
          <div className="-mr-1.5 flex items-center gap-1.5">{headerActions}</div>
        </SheetHeader>
        {panel}
      </SheetContent>
    </Sheet>
  );
}

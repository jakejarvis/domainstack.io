"use client";

import { useChat } from "@ai-sdk/react";
import { CHATBOT_NAME } from "@domainstack/constants";
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
} from "@domainstack/ui/drawer";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@domainstack/ui/sheet";
import { IconLayoutSidebarRightCollapse, IconLego } from "@tabler/icons-react";
import { WorkflowChatTransport } from "@workflow/ai";
import { useAtom, useSetAtom } from "jotai";
import { AnimatePresence } from "motion/react";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { BetaBadge } from "@/components/beta-badge";
import { useBrowserAI } from "@/hooks/use-browser-ai";
import { useChatPersistence } from "@/hooks/use-chat-persistence";
import { useLocalChat } from "@/hooks/use-local-chat";
import { useIsMobile } from "@/hooks/use-mobile";
import { analytics } from "@/lib/analytics/client";
import { chatOpenAtom, serverSuggestionsAtom } from "@/lib/atoms/chat-atoms";
import { buildClientSystemPrompt } from "@/lib/chat/client-prompt";
import { createClientDomainTools } from "@/lib/chat/client-tools";
import { useChatStore } from "@/lib/stores/chat-store";
import {
  usePreferencesHydrated,
  usePreferencesStore,
} from "@/lib/stores/preferences-store";
import { useTRPCClient } from "@/lib/trpc/client";
import { ChatFab } from "./chat-fab";
import { ChatHeaderActions } from "./chat-header-actions";
import { ChatPanel } from "./chat-panel";
import { ChatSettingsDialog } from "./chat-settings-dialog";
import { getUserFriendlyError } from "./utils";

interface ChatClientProps {
  suggestions?: string[];
}

export function ChatClient({ suggestions = [] }: ChatClientProps) {
  const [open, setOpen] = useAtom(chatOpenAtom);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const params = useParams<{ domain?: string }>();
  const isMobile = useIsMobile();
  const hydrated = usePreferencesHydrated();
  const hideAiFeatures = usePreferencesStore((s) => s.hideAiFeatures);
  const setHideAiFeatures = usePreferencesStore((s) => s.setHideAiFeatures);
  const aiMode = usePreferencesStore((s) => s.aiMode);

  const domain = params.domain ? decodeURIComponent(params.domain) : undefined;
  const domainRef = useRef(domain);
  domainRef.current = domain;

  // Browser AI detection and local chat setup
  const browserAI = useBrowserAI();
  const trpcClient = useTRPCClient();

  // Client-side tools and prompt for local chat
  const clientTools = useMemo(
    () => createClientDomainTools(trpcClient),
    [trpcClient],
  );
  const systemPrompt = useMemo(() => buildClientSystemPrompt(domain), [domain]);

  const runId = useChatStore((s) => s.runId);
  const runIdRef = useRef(runId);
  runIdRef.current = runId;
  const setRunId = useChatStore((s) => s.setRunId);
  const setMessages = useChatStore((s) => s.setMessages);
  const clearSession = useChatStore((s) => s.clearSession);

  // Capture initial runId for resume prop - must be stable to avoid AI SDK errors
  // when runId changes mid-session (e.g., onChatEnd clearing it)
  const initialRunIdRef = useRef<string | null | undefined>(undefined);
  if (initialRunIdRef.current === undefined) {
    initialRunIdRef.current = runId;
  }

  const transport = useMemo(
    () =>
      new WorkflowChatTransport({
        api: "/api/chat",
        prepareSendMessagesRequest: ({ messages }) => ({
          body: { messages, domain: domainRef.current },
        }),
        prepareReconnectToStreamRequest: ({ api, ...rest }) => {
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
          setMessages(options.messages);
          const workflowRunId = response.headers.get("x-workflow-run-id");
          if (workflowRunId) {
            setRunId(workflowRunId);
          }
        },
        onChatEnd: () => {
          setRunId(null);
        },
      }),
    [setMessages, setRunId],
  );

  // Cloud chat (via Vercel Workflow)
  // Use stable initialRunIdRef for resume to avoid AI SDK errors when runId changes
  const cloudChat = useChat({
    transport,
    resume: !!initialRunIdRef.current,
    onError: (error) => {
      analytics.trackException(error, { context: "chat-send", domain });
    },
  });

  // Determine effective mode based on preference and browser AI availability.
  // IMPORTANT: Once a cloud conversation is in progress, we lock to cloud mode
  // to prevent message loss when browser AI becomes ready mid-conversation.
  const effectiveMode = useMemo((): "cloud" | "local" => {
    // If there's an active cloud conversation, stay in cloud mode to avoid losing messages
    if (cloudChat.messages.length > 0) return "cloud";
    if (aiMode === "local" && browserAI.status === "ready") return "local";
    if (aiMode === "auto" && browserAI.status === "ready") return "local";
    return "cloud";
  }, [aiMode, browserAI.status, cloudChat.messages.length]);

  // Local chat (browser-based AI) - only active when effectiveMode is "local"
  // The hook handles null model gracefully (sendMessage becomes a no-op)
  const localChat = useLocalChat({
    model: browserAI.model,
    tools: clientTools,
    systemPrompt,
    onError: (error) => {
      analytics.trackException(error, { context: "local-chat-send", domain });
    },
  });

  // Select the active chat based on effective mode
  const chat = effectiveMode === "local" ? localChat : cloudChat;

  // Handle message persistence (restore from store, persist to store, clear runId on completion)
  // Only persist cloud chat messages (local chat doesn't have resumable workflows)
  useChatPersistence({
    messages: cloudChat.messages,
    status: cloudChat.status,
    setMessages: cloudChat.setMessages,
  });

  // Ref for clearMessages callback to avoid dependency on chat.setMessages
  const chatSetMessagesRef = useRef(chat.setMessages);
  chatSetMessagesRef.current = chat.setMessages;

  const clearMessages = useCallback(() => {
    chatSetMessagesRef.current([]);
    clearSession();
  }, [clearSession]);

  const sendMessage = useCallback(
    (msgParams: { text: string }) => {
      const text = msgParams.text.trim();
      if (!text) return;
      chat.sendMessage({ text });
    },
    [chat],
  );

  const { messages, status } = chat;

  // Don't show errors while streaming - if messages are coming through, the chat is working.
  // The WorkflowChatTransport may report errors from reconnection attempts that don't affect
  // the actual message stream (e.g., trying to reconnect after the workflow already completed).
  const error =
    status === "streaming"
      ? null
      : chat.error
        ? getUserFriendlyError(chat.error)
        : null;

  // Hydrate server suggestions into atom
  const setServerSuggestions = useSetAtom(serverSuggestionsAtom);
  useEffect(() => {
    setServerSuggestions(suggestions);
  }, [suggestions, setServerSuggestions]);

  // Check for ?show_ai=1 URL param to re-enable AI features
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get("show_ai") === "1" && hideAiFeatures) {
      setHideAiFeatures(false);
      urlParams.delete("show_ai");
      const newUrl =
        urlParams.toString() === ""
          ? window.location.pathname
          : `${window.location.pathname}?${urlParams.toString()}`;
      window.history.replaceState({}, "", newUrl);
    }
  }, [hideAiFeatures, setHideAiFeatures]);

  const chatClientProps = {
    messages,
    sendMessage,
    clearMessages,
    status,
    domain,
    error,
  };

  if (!hydrated) {
    return null;
  }

  if (hideAiFeatures && !settingsOpen) {
    return null;
  }

  const handleChatClick = () => {
    try {
      navigator.vibrate([50]);
    } catch {}
    setOpen(!open);
  };

  const handleSettingsClick = () => {
    setOpen(false);
    setSettingsOpen(true);
  };

  return (
    <>
      <AnimatePresence>
        {!hideAiFeatures && <ChatFab onClick={handleChatClick} />}
      </AnimatePresence>

      {isMobile ? (
        <Drawer open={open} onOpenChange={setOpen} handleOnly>
          <DrawerContent>
            <DrawerHeader className="flex flex-row items-center justify-between">
              <DrawerTitle className="flex items-center gap-2">
                <IconLego className="size-4" />
                <span className="font-semibold text-[15px] leading-none tracking-tight">
                  {CHATBOT_NAME}
                </span>
                <BetaBadge />
              </DrawerTitle>
              <div className="flex items-center gap-2">
                <ChatHeaderActions
                  messages={messages}
                  onClear={clearMessages}
                  onSettingsClick={handleSettingsClick}
                  onCloseClick={() => setOpen(false)}
                />
              </div>
            </DrawerHeader>
            <ChatPanel
              {...chatClientProps}
              conversationClassName="px-4"
              inputClassName="p-4"
            />
          </DrawerContent>
        </Drawer>
      ) : (
        <Sheet open={open} onOpenChange={setOpen}>
          <SheetContent
            side="right"
            className="flex w-[420px] flex-col gap-0 p-0"
            showCloseButton={false}
          >
            <SheetHeader className="flex shrink-0 flex-row items-center justify-between border-b bg-card/60 px-3.5 py-2">
              <SheetTitle className="flex items-center gap-2">
                <IconLego className="size-4" />
                <span className="font-semibold text-[15px] leading-none tracking-tight">
                  {CHATBOT_NAME}
                </span>
                <BetaBadge />
              </SheetTitle>
              <div className="-mr-1.5 flex items-center gap-1.5">
                <ChatHeaderActions
                  messages={messages}
                  onClear={clearMessages}
                  onSettingsClick={handleSettingsClick}
                  onCloseClick={() => setOpen(false)}
                  closeIcon={IconLayoutSidebarRightCollapse}
                />
              </div>
            </SheetHeader>
            <ChatPanel {...chatClientProps} inputClassName="p-3" />
          </SheetContent>
        </Sheet>
      )}

      <ChatSettingsDialog open={settingsOpen} onOpenChange={setSettingsOpen} />
    </>
  );
}

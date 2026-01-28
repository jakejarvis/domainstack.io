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
import { useSetAtom } from "jotai";
import { AnimatePresence } from "motion/react";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { BetaBadge } from "@/components/beta-badge";
import { useIsMobile } from "@/hooks/use-mobile";
import { analytics } from "@/lib/analytics/client";
import { serverSuggestionsAtom } from "@/lib/atoms/chat-atoms";
import { useChatStore } from "@/lib/stores/chat-store";
import {
  usePreferencesHydrated,
  usePreferencesStore,
} from "@/lib/stores/preferences-store";
import { ChatFab } from "./chat-fab";
import { ChatHeaderActions } from "./chat-header-actions";
import { ChatPanel } from "./chat-panel";
import { ChatSettingsDialog } from "./chat-settings-dialog";
import { getUserFriendlyError } from "./utils";

interface ChatClientProps {
  suggestions?: string[];
}

export function ChatClient({ suggestions = [] }: ChatClientProps) {
  const [open, setOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const params = useParams<{ domain?: string }>();
  const isMobile = useIsMobile();
  const hydrated = usePreferencesHydrated();
  const hideAiFeatures = usePreferencesStore((s) => s.hideAiFeatures);
  const setHideAiFeatures = usePreferencesStore((s) => s.setHideAiFeatures);

  const domain = params.domain ? decodeURIComponent(params.domain) : undefined;
  const domainRef = useRef(domain);
  domainRef.current = domain;

  const runId = useChatStore((s) => s.runId);
  const runIdRef = useRef(runId);
  runIdRef.current = runId;
  const storedMessages = useChatStore((s) => s.messages);
  const setRunId = useChatStore((s) => s.setRunId);
  const setMessages = useChatStore((s) => s.setMessages);
  const clearSession = useChatStore((s) => s.clearSession);

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

  const chat = useChat({
    transport,
    resume: !!runId,
    onError: (error) => {
      analytics.trackException(error, { context: "chat-send", domain });
      setSubmitError(getUserFriendlyError(error));
    },
  });

  const setChatMessagesRef = useRef(chat.setMessages);
  setChatMessagesRef.current = chat.setMessages;

  // Restore messages from store once on mount
  const hasRestored = useRef(false);
  useEffect(() => {
    if (hasRestored.current) return;
    hasRestored.current = true;
    if (storedMessages.length > 0) {
      setChatMessagesRef.current(storedMessages);
    }
  }, [storedMessages]);

  // Persist messages to store
  const isInitialized = useRef(false);
  // biome-ignore lint/correctness/useExhaustiveDependencies: using .length + status to balance write frequency with capturing final streamed content
  useEffect(() => {
    if (!isInitialized.current) {
      if (chat.messages.length > 0) {
        isInitialized.current = true;
      }
      return;
    }
    if (chat.messages.length > 0) {
      setMessages(chat.messages);
    }
  }, [chat.messages.length, chat.status, setMessages]);

  // Clear runId when chat completes successfully.
  // The WorkflowChatTransport's onChatEnd callback should clear runId when a finish chunk
  // is received, but sometimes the finish chunk is not received (e.g., during tool execution
  // when the workflow suspends). This effect handles that case by detecting when the chat
  // transitions from streaming to ready with assistant messages, indicating completion.
  const prevStatusRef = useRef(chat.status);
  useEffect(() => {
    const wasStreaming = prevStatusRef.current === "streaming";
    const isNowReady = chat.status === "ready";
    const hasAssistantMessage = chat.messages.some(
      (m) => m.role === "assistant",
    );

    if (wasStreaming && isNowReady && hasAssistantMessage && runId) {
      // Chat completed but onChatEnd wasn't called - clear runId to prevent stale reconnection attempts
      setRunId(null);
    }

    prevStatusRef.current = chat.status;
  }, [chat.status, chat.messages, runId, setRunId]);

  const clearError = useCallback(() => {
    setSubmitError(null);
  }, []);

  const clearMessages = useCallback(() => {
    setChatMessagesRef.current([]);
    setSubmitError(null);
    clearSession();
  }, [clearSession]);

  const sendMessage = useCallback(
    (msgParams: { text: string }) => {
      const text = msgParams.text.trim();
      if (!text) {
        setSubmitError("Please enter a message.");
        return;
      }
      clearError();
      chat.sendMessage({ text });
    },
    [chat, clearError],
  );

  const { messages, status } = chat;

  // Don't show errors while streaming - if messages are coming through, the chat is working.
  // The WorkflowChatTransport may report errors from reconnection attempts that don't affect
  // the actual message stream (e.g., trying to reconnect after the workflow already completed).
  // These errors come through both onError (setting submitError) and chat.error.
  const error =
    status === "streaming"
      ? null
      : (submitError ?? (chat.error ? getUserFriendlyError(chat.error) : null));

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
    onClearError: clearError,
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

"use client";

import { useChat } from "@ai-sdk/react";
import { Button } from "@domainstack/ui/button";
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
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@domainstack/ui/tooltip";
import {
  IconLayoutSidebarRightCollapse,
  IconLego,
  IconMessageCircleFilled,
} from "@tabler/icons-react";
import { WorkflowChatTransport } from "@workflow/ai";
import { useSetAtom } from "jotai";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { BetaBadge } from "@/components/beta-badge";
import { useIsMobile } from "@/hooks/use-mobile";
import { analytics } from "@/lib/analytics/client";
import { serverSuggestionsAtom } from "@/lib/atoms/chat-atoms";
import { CHATBOT_NAME } from "@/lib/constants/ai";
import { useChatStore } from "@/lib/stores/chat-store";
import { usePreferencesStore } from "@/lib/stores/preferences-store";
import { ChatClient } from "./chat-client";
import { ChatHeaderActions } from "./chat-header-actions";
import { ChatSettingsDialog } from "./chat-settings-dialog";
import { getUserFriendlyError } from "./utils";

const MotionButton = motion.create(Button);

interface ChatTriggerClientProps {
  suggestions?: string[];
}

export function ChatTriggerClient({
  suggestions = [],
}: ChatTriggerClientProps) {
  const [open, setOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const params = useParams<{ domain?: string }>();
  const isMobile = useIsMobile();
  const prefersReducedMotion = useReducedMotion();
  const hideAiFeatures = usePreferencesStore((s) => s.hideAiFeatures);
  const setHideAiFeatures = usePreferencesStore((s) => s.setHideAiFeatures);

  const domain = params.domain ? decodeURIComponent(params.domain) : undefined;
  const domainRef = useRef(domain);
  domainRef.current = domain;

  const runId = useChatStore((s) => s.runId);
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

  const error =
    submitError ?? (chat.error ? getUserFriendlyError(chat.error) : null);
  const { messages, status } = chat;

  // Hydrate server suggestions into atom
  const setServerSuggestions = useSetAtom(serverSuggestionsAtom);
  useEffect(() => {
    setServerSuggestions(suggestions);
  }, [suggestions, setServerSuggestions]);

  // Wait for client-side hydration to read localStorage
  useEffect(() => {
    setMounted(true);
  }, []);

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

  if (!mounted) {
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
        {!hideAiFeatures && (
          <Tooltip>
            <TooltipTrigger
              render={
                <MotionButton
                  variant="default"
                  size="icon-lg"
                  aria-label={`Chat with ${CHATBOT_NAME}`}
                  className="fixed right-6 bottom-6 z-40 rounded-full shadow-lg transition-none"
                  onClick={handleChatClick}
                  initial={prefersReducedMotion ? false : { opacity: 0, y: 16 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 16 }}
                  transition={{
                    duration: 0.25,
                    ease: [0.22, 1, 0.36, 1] as const,
                  }}
                >
                  <IconMessageCircleFilled className="size-5 text-background/95" />
                </MotionButton>
              }
            />
            <TooltipContent side="left" sideOffset={8}>
              Chat with {CHATBOT_NAME}
            </TooltipContent>
          </Tooltip>
        )}
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
            <ChatClient
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
            <ChatClient {...chatClientProps} inputClassName="p-3" />
          </SheetContent>
        </Sheet>
      )}

      <ChatSettingsDialog open={settingsOpen} onOpenChange={setSettingsOpen} />
    </>
  );
}

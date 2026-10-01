import type { ChatStatus, UIMessage } from "ai";
import { afterEach, describe, expect, it } from "vitest";

import { useChatStore } from "@/lib/stores/chat-store";
import { renderHook } from "@/mocks/react";

import { useChatPersistence } from "./use-chat-persistence";

function message(id: string, role: UIMessage["role"], text: string): UIMessage {
  return { id, role, parts: [{ type: "text", text }] };
}

const user = message("u1", "user", "hello");
const partial = message("a1", "assistant", "par");
const full = message("a1", "assistant", "partial answer");

interface Props {
  messages: UIMessage[];
  status: ChatStatus;
}

async function renderPersistence(initialProps: Props) {
  return renderHook<Props, void>((props) => useChatPersistence(props ?? initialProps), {
    initialProps,
  });
}

describe("useChatPersistence", () => {
  afterEach(() => {
    useChatStore.getState().clearSession();
  });

  it("does not persist a partial assistant reply while streaming", async () => {
    // onChatSendMessage has already stored the outgoing user turn.
    useChatStore.getState().setMessages([user]);

    const { rerender } = await renderPersistence({ messages: [user], status: "submitted" });

    await rerender({ messages: [user, partial], status: "streaming" });

    expect(useChatStore.getState().messages).toEqual([user]);
  });

  it("persists the full conversation once the turn is ready", async () => {
    useChatStore.getState().setMessages([user]);

    const { rerender } = await renderPersistence({ messages: [user], status: "submitted" });

    await rerender({ messages: [user, partial], status: "streaming" });
    await rerender({ messages: [user, full], status: "ready" });

    expect(useChatStore.getState().messages).toEqual([user, full]);
  });

  it("keeps what arrived when the turn errors", async () => {
    useChatStore.getState().setMessages([user]);

    const { rerender } = await renderPersistence({ messages: [user], status: "submitted" });

    await rerender({ messages: [user, partial], status: "streaming" });
    await rerender({ messages: [user, partial], status: "error" });

    expect(useChatStore.getState().messages).toEqual([user, partial]);
  });
});

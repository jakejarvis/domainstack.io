import { beforeEach, describe, expect, it, vi } from "vitest";
import { page, userEvent } from "vitest/browser";

import type { UseBrowserAIResult } from "@/hooks/use-browser-ai";
import { render } from "@/mocks/react";

import { type ChatController, ChatPanel } from "./chat-panel";
import { LOCAL_NOT_READY_MESSAGE } from "./utils";

const browserAI = {
  status: "downloadable",
  downloadProgress: 0,
  error: null,
  model: null,
  initialize: vi.fn<() => Promise<void>>(async () => undefined),
} satisfies UseBrowserAIResult;

const chat = {
  messages: [],
  status: "ready",
  error: null,
  sendMessage: vi.fn<ChatController["sendMessage"]>(),
  clearMessages: vi.fn<ChatController["clearMessages"]>(),
  retry: vi.fn<ChatController["retry"]>(),
  clearError: vi.fn<ChatController["clearError"]>(),
} satisfies ChatController;

describe("ChatPanel", () => {
  beforeEach(() => {
    chat.sendMessage.mockClear();
    chat.clearMessages.mockClear();
  });

  it("sends the typed message on Enter", async () => {
    await render(<ChatPanel chat={chat} browserAI={browserAI} activeMode="cloud" />);

    await page.getByRole("textbox", { name: "Ask about a domain" }).fill("example.com");
    await userEvent.keyboard("{Enter}");

    expect(chat.sendMessage).toHaveBeenCalledWith({ text: "example.com" });
  });

  it("explains the block and does not send while local mode can't take the message", async () => {
    await render(
      <ChatPanel
        chat={chat}
        browserAI={browserAI}
        activeMode="cloud"
        blockedReason={LOCAL_NOT_READY_MESSAGE}
        homeSuggestions={["Is example.com available?"]}
      />,
    );

    await expect.element(page.getByRole("status")).toHaveTextContent(LOCAL_NOT_READY_MESSAGE);

    await page.getByRole("textbox", { name: "Ask about a domain" }).fill("example.com");
    await userEvent.keyboard("{Enter}");
    await page.getByRole("button", { name: "Is example.com available?" }).click();

    expect(chat.sendMessage).not.toHaveBeenCalled();
    expect(chat.clearMessages).not.toHaveBeenCalled();
  });
});

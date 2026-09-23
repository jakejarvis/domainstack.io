import { formatForDisplay } from "@tanstack/react-hotkeys";
import { useEffect } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { page, userEvent } from "vitest/browser";

import { render } from "@/mocks/react";

import { ChatClientLazy } from "./chat-client-lazy";
import { CHAT_HOTKEY } from "./chat-fab";

const preferences = vi.hoisted(() => ({
  hydrated: true,
  hideAiFeatures: false,
  setHideAiFeatures: vi.fn<(hidden: boolean) => void>(),
}));

vi.mock("@/lib/stores/preferences-store", () => ({
  usePreferencesHydrated: () => preferences.hydrated,
  usePreferencesStore: (
    selector: (state: {
      hideAiFeatures: boolean;
      setHideAiFeatures: (hidden: boolean) => void;
    }) => unknown,
  ) => selector(preferences),
}));

function TestChatClient({
  open,
  onOpenChange,
  onReady,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onReady: () => void;
}) {
  useEffect(() => onReady(), [onReady]);

  if (!open) return null;
  return (
    <button type="button" onClick={() => onOpenChange(false)}>
      Close test chat
    </button>
  );
}

describe("ChatClientLazy", () => {
  beforeEach(() => {
    preferences.hydrated = true;
    preferences.hideAiFeatures = false;
    preferences.setHideAiFeatures.mockClear();
  });

  it("loads chat with Mod+I, then toggles the loaded chat", async () => {
    const loader = vi.fn<() => Promise<{ ChatClient: typeof TestChatClient }>>(async () => ({
      ChatClient: TestChatClient,
    }));
    await render(<ChatClientLazy loader={loader} />);

    expect(loader).not.toHaveBeenCalled();
    await expect
      .element(
        page.getByText(formatForDisplay(CHAT_HOTKEY, { separatorToken: "\u00A0" }), {
          exact: true,
        }),
      )
      .toBeVisible();

    const isMac = /mac/i.test(navigator.userAgent);
    const shortcut = isMac ? "{Meta>}i{/Meta}" : "{Control>}i{/Control}";
    await userEvent.keyboard(shortcut);

    await expect.element(page.getByRole("button", { name: "Close test chat" })).toBeVisible();
    expect(loader).toHaveBeenCalledOnce();

    await userEvent.keyboard(shortcut);
    await expect
      .element(page.getByRole("button", { name: "Close test chat" }))
      .not.toBeInTheDocument();

    await userEvent.keyboard(shortcut);

    await expect.element(page.getByRole("button", { name: "Close test chat" })).toBeVisible();
    expect(loader).toHaveBeenCalledOnce();
  });

  it("starts loading on hover and reuses that load for the click", async () => {
    const loader = vi.fn<() => Promise<{ ChatClient: typeof TestChatClient }>>(async () => ({
      ChatClient: TestChatClient,
    }));
    await render(<ChatClientLazy loader={loader} />);

    const fab = page.getByRole("button", { name: "Ask AI" }).last();
    await fab.hover();
    await vi.waitFor(() => expect(loader).toHaveBeenCalledOnce());

    await fab.click();
    await expect.element(page.getByRole("button", { name: "Close test chat" })).toBeVisible();
    expect(loader).toHaveBeenCalledOnce();
  });

  it("retries after a failed load and announces the failure", async () => {
    const loader = vi
      .fn<() => Promise<{ ChatClient: typeof TestChatClient }>>()
      .mockRejectedValue(new Error("offline"));
    await render(<ChatClientLazy loader={loader} />);

    const fab = page.getByRole("button", { name: "Ask AI" }).last();
    await fab.click();
    await expect.element(page.getByText("Chat failed to load. Try again.")).toBeInTheDocument();

    loader.mockResolvedValue({ ChatClient: TestChatClient });
    await fab.click();
    await expect.element(page.getByRole("button", { name: "Close test chat" })).toBeVisible();
  });

  it("keeps the hover gradient's animation paused until hovered", async () => {
    await render(<ChatClientLazy loader={async () => ({ ChatClient: TestChatClient })} />);

    await expect
      .poll(() => document.querySelector("[data-slot=mesh-gradient]"))
      .toBeInstanceOf(HTMLElement);
    const mesh = document.querySelector("[data-slot=mesh-gradient]") as HTMLElement;
    // the pointer may still rest where an earlier test left it
    await page.getByRole("button", { name: "Ask AI" }).last().unhover();
    expect(getComputedStyle(mesh).animationPlayState).toBe("paused");

    await page.getByRole("button", { name: "Ask AI" }).last().hover();
    expect(getComputedStyle(mesh).animationPlayState).toBe("running");
  });
});

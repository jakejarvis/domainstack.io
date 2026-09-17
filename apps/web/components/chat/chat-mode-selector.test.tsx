import { beforeEach, describe, expect, it, vi } from "vitest";
import { page } from "vitest/browser";

import type { UseBrowserAIResult } from "@/hooks/use-browser-ai";
import { render } from "@/mocks/react";

import { ChatModeSelector } from "./chat-mode-selector";

const preferences = vi.hoisted(() => ({
  aiMode: "cloud" as "auto" | "cloud" | "local",
  setAiMode: vi.fn<(mode: "auto" | "cloud" | "local") => void>(),
}));

vi.mock("@/lib/stores/preferences-store", () => ({
  usePreferencesStore: (
    selector: (state: {
      aiMode: "auto" | "cloud" | "local";
      setAiMode: (mode: "auto" | "cloud" | "local") => void;
    }) => unknown,
  ) => selector(preferences),
}));

const browserAI = {
  status: "ready",
  downloadProgress: 0,
  error: null,
  model: null,
  initialize: vi.fn<() => Promise<void>>(async () => undefined),
} satisfies UseBrowserAIResult;

describe("ChatModeSelector", () => {
  beforeEach(() => {
    preferences.aiMode = "cloud";
    preferences.setAiMode.mockClear();
    browserAI.initialize.mockClear();
  });

  it("renders the current mode and selects a mode from the listbox", async () => {
    await render(<ChatModeSelector browserAI={browserAI} />);

    const trigger = page.getByRole("combobox", { name: "AI Provider" });
    await expect.element(trigger.getByText("Cloud", { exact: true })).toBeVisible();

    await trigger.click();

    const localOption = page.getByRole("option", { name: /Local/ });
    await expect.element(localOption).toBeVisible();

    await localOption.click();

    expect(preferences.setAiMode).toHaveBeenCalledWith("local");
    await expect.element(page.getByRole("listbox")).not.toBeInTheDocument();
  });

  it("starts the local model download without selecting the mode", async () => {
    await render(<ChatModeSelector browserAI={{ ...browserAI, status: "downloadable" }} />);

    await page.getByRole("combobox", { name: "AI Provider" }).click();
    await page.getByRole("button", { name: "Download on-device model" }).click();

    expect(browserAI.initialize).toHaveBeenCalledOnce();
    expect(preferences.setAiMode).not.toHaveBeenCalled();
    await expect.element(page.getByRole("listbox")).toBeVisible();
  });

  it("shows availability help when the disabled local option is hovered", async () => {
    await render(<ChatModeSelector browserAI={{ ...browserAI, status: "unavailable" }} />);

    await page.getByRole("combobox", { name: "AI Provider" }).click();
    await page.getByRole("option", { name: /Local/ }).hover();

    await expect.element(page.getByText(/Requires latest/)).toBeVisible();
  });
});

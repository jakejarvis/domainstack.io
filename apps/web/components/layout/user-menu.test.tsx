import { toast } from "sonner";
import { afterEach, beforeEach, describe, expect, it, onTestFinished, vi } from "vitest";
import { page } from "vitest/browser";

import { UserMenu } from "@/components/layout/user-menu";
import { useChatStore } from "@/lib/stores/chat-store";
import { createTestQueryClient, render } from "@/mocks/react";

const auth = vi.hoisted(() => ({
  signOut: vi.fn<(opts: { fetchOptions?: { onSuccess?: () => void } }) => Promise<unknown>>(),
}));

vi.mock("sonner", () => ({
  toast: {
    error: vi.fn<(message?: string) => void>(),
  },
}));

vi.mock("@domainstack/auth/client", () => ({
  useSession: () => ({
    data: { user: { id: "u1", name: "Alex Doe", email: "a@example.com" } },
  }),
  signOut: auth.signOut,
}));

describe("UserMenu sign out", () => {
  beforeEach(() => {
    vi.mocked(toast.error).mockClear();
    auth.signOut.mockImplementation(async (opts) => {
      opts.fetchOptions?.onSuccess?.();
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
    useChatStore.getState().clearSession();
  });

  it("clears the query cache and chat session, then navigates home with a full-page load", async () => {
    // `window.location.assign` is an unforgeable property (not spy-able), so
    // intercept the navigation itself via the Navigation API instead.
    const navigations: string[] = [];
    const onNavigate = (event: NavigateEvent) => {
      navigations.push(new URL(event.destination.url).pathname);
      event.preventDefault();
    };
    window.navigation.addEventListener("navigate", onNavigate);
    onTestFinished(() => window.navigation.removeEventListener("navigate", onNavigate));

    useChatStore
      .getState()
      .setMessages([{ id: "m1", role: "user", parts: [{ type: "text", text: "hi" }] }]);
    const queryClient = createTestQueryClient();
    queryClient.setQueryData(["probe"], 1);

    await render(<UserMenu />, { queryClient });

    await page.getByRole("button", { name: "User menu" }).click();
    await page.getByRole("menuitem", { name: "Sign out" }).click();

    await vi.waitFor(() => expect(navigations).toEqual(["/"]));
    expect(auth.signOut).toHaveBeenCalledTimes(1);
    expect(queryClient.getQueryData(["probe"])).toBeUndefined();
    expect(useChatStore.getState().messages).toHaveLength(0);
  });

  it("toasts and keeps the session when Better Auth resolves a sign-out error", async () => {
    auth.signOut.mockResolvedValue({ data: null, error: { status: 500 } });

    const queryClient = createTestQueryClient();
    queryClient.setQueryData(["probe"], 1);

    await render(<UserMenu />, { queryClient });

    await page.getByRole("button", { name: "User menu" }).click();
    await page.getByRole("menuitem", { name: "Sign out" }).click();

    await vi.waitFor(() => expect(toast.error).toHaveBeenCalledTimes(1));
    expect(toast.error).toHaveBeenCalledWith("Couldn't sign you out. Please try again.");
    expect(queryClient.getQueryData(["probe"])).toBe(1);
  });
});

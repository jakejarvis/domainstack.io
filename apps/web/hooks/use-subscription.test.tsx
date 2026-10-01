import { toast } from "sonner";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { page } from "vitest/browser";

const auth = vi.hoisted(() => ({
  portal: vi.fn<() => Promise<unknown>>(),
}));

vi.mock("@/lib/trpc/client", async () => {
  const { useTRPC } = await import("@/mocks/trpc");
  return { useTRPC };
});
vi.mock("@domainstack/auth/client", () => ({
  customer: { portal: auth.portal },
  checkoutEmbed: vi.fn<() => Promise<unknown>>(),
}));
vi.mock("sonner", () => ({
  toast: {
    error: vi.fn<(message?: string) => void>(),
  },
}));

import { render } from "@/mocks/react";

import { useSubscription } from "./use-subscription";

function PortalButton() {
  const { handleCustomerPortal, isCustomerPortalLoading } = useSubscription({ enabled: false });
  return (
    <button type="button" onClick={handleCustomerPortal}>
      {isCustomerPortalLoading ? "Loading portal" : "Manage billing"}
    </button>
  );
}

describe("useSubscription handleCustomerPortal", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("toasts once and clears loading when the portal resolves an error", async () => {
    auth.portal.mockResolvedValue({ data: null, error: { status: 500 } });

    await render(<PortalButton />);
    await page.getByRole("button", { name: "Manage billing" }).click();

    await vi.waitFor(() => expect(toast.error).toHaveBeenCalledTimes(1));
    expect(toast.error).toHaveBeenCalledWith("Failed to open customer portal. Please try again.");
    await expect.element(page.getByRole("button", { name: "Manage billing" })).toBeVisible();
    expect(auth.portal).toHaveBeenCalledTimes(1);
  });
});

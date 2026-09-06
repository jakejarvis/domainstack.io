import { beforeEach, describe, expect, it, vi } from "vitest";
import { page, userEvent } from "vitest/browser";

import { render } from "@/mocks/react";

import { HeaderSearchClient } from "./header-search-client";

const nav = vi.hoisted(() => ({
  push: vi.fn<(href: string) => void | Promise<void>>(),
  params: { domain: "Test.INVALID" },
}));

vi.mock("@/hooks/use-router", () => ({
  useRouter: () => ({ push: nav.push }),
}));

vi.mock("next/navigation", () => ({
  useParams: () => nav.params,
  useSelectedLayoutSegment: () => "domain",
}));

function domainSearchInput() {
  return page.getByRole("textbox", { name: "Domain" });
}

describe("HeaderSearch", () => {
  beforeEach(() => {
    nav.push.mockClear();
  });

  it("prefills normalized domain from params and navigates on Enter", async () => {
    nav.params = { domain: "Sub.Test.INVALID" };
    await render(<HeaderSearchClient />);
    const input = domainSearchInput();
    await expect.element(input).toHaveValue("sub.test.invalid");
    await userEvent.type(input, "{Enter}");
    expect(nav.push).toHaveBeenCalledWith("/sub.test.invalid");
  });

  it("does nothing on invalid domain", async () => {
    nav.params = { domain: "invalid domain" };
    await render(<HeaderSearchClient />);
    const input = domainSearchInput();
    await userEvent.type(input, "{Enter}");
    expect(nav.push).not.toHaveBeenCalled();
  });

  it("re-enables the input after navigating to a new route", async () => {
    let finishNavigation: (() => void) | undefined;
    nav.push.mockImplementation(
      () =>
        new Promise<void>((resolve) => {
          finishNavigation = resolve;
        }),
    );

    nav.params = { domain: "foo.invalid" };
    const { rerender } = await render(<HeaderSearchClient />);
    const input = domainSearchInput();
    // Submit to trigger loading state (disables input)
    await userEvent.type(input, "{Enter}");
    await expect.element(input).toBeDisabled();
    // Simulate navigation by changing route params and re-rendering
    nav.params = { domain: "bar.invalid" };
    await rerender(<HeaderSearchClient />);
    finishNavigation?.();
    await expect.element(domainSearchInput()).toBeEnabled();
  });
});

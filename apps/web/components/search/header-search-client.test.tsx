import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@/mocks/react";
import { HeaderSearchClient } from "./header-search-client";
import { HeaderSearchProvider } from "./header-search-context";

const nav = vi.hoisted(() => ({
  push: vi.fn(),
  params: { domain: "Test.INVALID" as string | undefined },
}));

vi.mock("@/hooks/use-router", () => ({
  useRouter: () => ({ push: nav.push }),
}));

vi.mock("next/navigation", () => ({
  useParams: () => nav.params,
  useSelectedLayoutSegment: () => "domain",
}));

describe("HeaderSearch", () => {
  beforeEach(() => {
    nav.push.mockClear();
  });

  it("prefills normalized domain from params and navigates on Enter", async () => {
    nav.params = { domain: "Sub.Test.INVALID" };
    render(
      <HeaderSearchProvider>
        <HeaderSearchClient />
      </HeaderSearchProvider>,
    );
    const input = screen.getByLabelText(/Search any domain/i);
    expect(input).toHaveValue("sub.test.invalid");
    await userEvent.type(input, "{Enter}");
    expect(nav.push).toHaveBeenCalledWith("/sub.test.invalid");
  });

  it("does nothing on invalid domain", async () => {
    nav.params = { domain: "invalid domain" } as { domain: string };
    render(
      <HeaderSearchProvider>
        <HeaderSearchClient />
      </HeaderSearchProvider>,
    );
    const input = screen.getByLabelText(/Search any domain/i);
    await userEvent.type(input, "{Enter}");
    expect(nav.push).not.toHaveBeenCalled();
  });

  it("re-enables the input after navigating to a new route", async () => {
    nav.params = { domain: "foo.invalid" };
    const { rerender } = render(
      <HeaderSearchProvider>
        <HeaderSearchClient />
      </HeaderSearchProvider>,
    );
    const input = screen.getByLabelText(/Search any domain/i);
    // Submit to trigger loading state (disables input)
    await userEvent.type(input, "{Enter}");
    expect(input).toBeDisabled();
    // Simulate navigation by changing route params and re-rendering
    nav.params = { domain: "bar.invalid" };
    rerender(
      <HeaderSearchProvider>
        <HeaderSearchClient />
      </HeaderSearchProvider>,
    );
    await waitFor(() =>
      expect(screen.getByLabelText(/Search any domain/i)).not.toBeDisabled(),
    );
  });
});

import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { render, screen, waitFor } from "@/mocks/react";

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

// Mock base-ui Form to avoid React instance mismatch in browser tests
vi.mock("@/components/ui/form", () => ({
  Form: ({
    children,
    onFormSubmit,
    ...props
  }: React.ComponentProps<"form"> & { onFormSubmit?: () => void }) => (
    <form
      {...props}
      onSubmit={(e) => {
        e.preventDefault();
        onFormSubmit?.();
      }}
    >
      {children}
    </form>
  ),
}));

describe("HeaderSearch", () => {
  beforeEach(() => {
    nav.push.mockClear();
  });

  it("prefills normalized domain from params and navigates on Enter", async () => {
    nav.params = { domain: "Sub.Test.INVALID" };
    render(<HeaderSearchClient />);
    const input = screen.getByLabelText(/Search any domain/i);
    expect(input).toHaveValue("sub.test.invalid");
    await userEvent.type(input, "{Enter}");
    expect(nav.push).toHaveBeenCalledWith("/sub.test.invalid");
  });

  it("does nothing on invalid domain", async () => {
    nav.params = { domain: "invalid domain" };
    render(<HeaderSearchClient />);
    const input = screen.getByLabelText(/Search any domain/i);
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
    const { rerender } = render(<HeaderSearchClient />);
    const input = screen.getByLabelText(/Search any domain/i);
    // Submit to trigger loading state (disables input)
    await userEvent.type(input, "{Enter}");
    expect(input).toBeDisabled();
    // Simulate navigation by changing route params and re-rendering
    nav.params = { domain: "bar.invalid" };
    rerender(<HeaderSearchClient />);
    finishNavigation?.();
    await waitFor(() => expect(screen.getByLabelText(/Search any domain/i)).not.toBeDisabled());
  });
});

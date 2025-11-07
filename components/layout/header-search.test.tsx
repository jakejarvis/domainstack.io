/* @vitest-environment jsdom */
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { HeaderSearch } from "./header-search";

const nav = vi.hoisted(() => ({
  push: vi.fn(),
  params: { domain: "Example.COM" as string | undefined },
}));

vi.mock("@/hooks/use-router", () => ({
  useRouter: () => ({ push: nav.push }),
}));

vi.mock("next/navigation", () => ({
  useParams: () => nav.params,
  usePathname: () => "/x",
}));

describe("HeaderSearch", () => {
  beforeEach(() => {
    nav.push.mockClear();
  });

  it("prefills normalized domain from params and navigates on Enter", async () => {
    nav.params = { domain: "Sub.Example.COM" };
    render(<HeaderSearch />);
    const input = screen.getByLabelText(/Search any domain/i);
    expect(input).toHaveValue("sub.example.com");
    await userEvent.type(input, "{Enter}");
    expect(nav.push).toHaveBeenCalledWith("/sub.example.com");
  });

  it("does nothing on invalid domain", async () => {
    nav.params = { domain: "invalid domain" } as { domain: string };
    render(<HeaderSearch />);
    const input = screen.getByLabelText(/Search any domain/i);
    await userEvent.type(input, "{Enter}");
    expect(nav.push).not.toHaveBeenCalled();
  });

  it("re-enables the input after navigating to a new route", async () => {
    nav.params = { domain: "foo.com" };
    const { rerender } = render(<HeaderSearch />);
    const input = screen.getByLabelText(/Search any domain/i);
    // Submit to trigger loading state (disables input)
    await userEvent.type(input, "{Enter}");
    expect(input).toBeDisabled();
    // Simulate navigation by changing route params and re-rendering
    nav.params = { domain: "bar.com" };
    rerender(<HeaderSearch />);
    await waitFor(() =>
      expect(screen.getByLabelText(/Search any domain/i)).not.toBeDisabled(),
    );
  });
});

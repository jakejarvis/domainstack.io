/* @vitest-environment jsdom */
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ProviderValue } from "./provider-value";

vi.mock("@/components/domain/favicon", () => ({
  Favicon: ({ domain }: { domain: string }) => <div>icon:{domain}</div>,
}));

describe("ProviderValue", () => {
  it("renders name and favicon when domain provided", () => {
    render(<ProviderValue name="Cloudflare" domain="cloudflare.com" />);
    expect(screen.getByText("Cloudflare")).toBeInTheDocument();
    expect(screen.getByText(/icon:cloudflare.com/)).toBeInTheDocument();
  });

  it("renders name only when domain is null", () => {
    render(<ProviderValue name="Not configured" domain={null} />);
    expect(screen.getByText("Not configured")).toBeInTheDocument();
    expect(screen.queryByText(/icon:/)).toBeNull();
  });
});

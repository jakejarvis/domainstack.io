import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@/lib/test-utils";
import { ProviderValue } from "./provider-value";

vi.mock("@/components/domain/provider-logo", () => ({
  ProviderLogo: ({
    providerId,
    providerName,
  }: {
    providerId: string | null | undefined;
    providerName: string | null | undefined;
  }) => (
    <div>
      logo:{providerId}:{providerName}
    </div>
  ),
}));

describe("ProviderValue", () => {
  it("renders name and logo when provider ID provided", () => {
    render(
      <ProviderValue
        id="provider-123"
        name="Cloudflare"
        domain="cloudflare.com"
      />,
    );
    expect(screen.getByText("Cloudflare")).toBeInTheDocument();
    expect(
      screen.getByText(/logo:provider-123:Cloudflare/),
    ).toBeInTheDocument();
  });

  it("renders name only when provider ID is null", () => {
    render(<ProviderValue id={null} name="Not configured" domain={null} />);
    expect(screen.getByText("Not configured")).toBeInTheDocument();
    expect(screen.queryByText(/logo:/)).toBeNull();
  });
});

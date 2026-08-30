import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { RawDataDialog } from "@/components/domain/registration/raw-data-dialog";
import { render, screen, within } from "@/mocks/react";

vi.mock("@/components/icons/favicon", () => ({
  Favicon: ({ domain }: { domain: string }) => <div data-slot="favicon" data-domain={domain} />,
}));

describe("RawDataDialog", () => {
  it("highlights RDAP JSON keys, strings, numbers, booleans, and null", async () => {
    const user = userEvent.setup();

    render(
      <RawDataDialog
        domain="example.com"
        format="RDAP"
        data={{
          ldhName: "example.com",
          port43: null,
          secureDNS: { delegationSigned: false },
          entities: [{ publicIds: [{ identifier: 123 }] }],
        }}
        serverName="rdap.verisign.com"
        serverUrl="https://rdap.verisign.com/com/v1/"
      />,
    );

    await user.click(screen.getByRole("button", { name: "View raw RDAP data" }));

    const dialog = await screen.findByRole("dialog");
    const code = within(dialog).getByLabelText("Raw RDAP data");

    expect(within(code).getByText('"ldhName"')).toHaveClass("text-blue-700");
    expect(within(code).getByText('"example.com"')).toHaveClass("text-emerald-700");
    expect(within(code).getByText("123")).toHaveClass("text-amber-700");
    expect(within(code).getByText("false")).toHaveClass("text-violet-700");
    expect(within(code).getByText("null")).toHaveClass("text-stone-500");
  });

  it("renders WHOIS text without JSON token classes", async () => {
    const user = userEvent.setup();

    render(
      <RawDataDialog
        domain="example.com"
        format="WHOIS"
        data={"Domain Name: EXAMPLE.COM\nRegistrar: Reserved"}
        serverName="whois.verisign-grs.com"
        serverUrl={undefined}
      />,
    );

    await user.click(screen.getByRole("button", { name: "View raw WHOIS data" }));

    const dialog = await screen.findByRole("dialog");
    const code = within(dialog).getByLabelText("Raw WHOIS data");

    expect(within(code).getByText(/Domain Name: EXAMPLE.COM/)).not.toHaveClass("text-blue-700");
    expect(within(code).queryByText('"ldhName"')).not.toBeInTheDocument();
  });
});

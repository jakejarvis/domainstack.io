import { describe, expect, it, vi } from "vitest";
import { page } from "vitest/browser";

import { RawDataDialog } from "@/components/domain/registration/raw-data-dialog";
import { render } from "@/mocks/react";

vi.mock("@/components/icons/favicon", () => ({
  Favicon: ({ domain }: { domain: string }) => <div data-slot="favicon" data-domain={domain} />,
}));

describe("RawDataDialog", () => {
  it("highlights RDAP JSON keys, strings, numbers, booleans, and null", async () => {
    await render(
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

    await page.getByRole("button", { name: "View raw RDAP data" }).click();

    await expect.element(page.getByRole("dialog")).toBeInTheDocument();
    const code = page.getByLabelText("Raw RDAP data");

    await expect.element(code.getByText('"ldhName"', { exact: true })).toHaveClass("text-blue-700");
    await expect
      .element(code.getByText('"example.com"', { exact: true }))
      .toHaveClass("text-emerald-700");
    await expect.element(code.getByText("123", { exact: true })).toHaveClass("text-amber-700");
    await expect.element(code.getByText("false", { exact: true })).toHaveClass("text-violet-700");
    await expect.element(code.getByText("null", { exact: true })).toHaveClass("text-stone-500");
  });

  it("renders WHOIS text without JSON token classes", async () => {
    await render(
      <RawDataDialog
        domain="example.com"
        format="WHOIS"
        data={"Domain Name: EXAMPLE.COM\nRegistrar: Reserved"}
        serverName="whois.verisign-grs.com"
        serverUrl={undefined}
      />,
    );

    await page.getByRole("button", { name: "View raw WHOIS data" }).click();

    await expect.element(page.getByRole("dialog")).toBeInTheDocument();
    const code = page.getByLabelText("Raw WHOIS data");

    await expect
      .element(code.getByText(/Domain Name: EXAMPLE.COM/))
      .not.toHaveClass("text-blue-700");
    await expect.element(code.getByText('"ldhName"', { exact: true })).not.toBeInTheDocument();
  });
});

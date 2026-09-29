import { describe, expect, it, vi } from "vitest";
import { page } from "vitest/browser";

import { render } from "@/mocks/react";

import { DomainMuteList } from "./domain-mute-list";

vi.mock("@/components/icons/favicon", () => ({
  Favicon: ({ domain, initialUrl }: { domain: string; initialUrl?: string | null }) => (
    <span
      data-slot="favicon"
      data-domain={domain}
      data-initial-url={initialUrl === undefined ? "undefined" : String(initialUrl)}
    />
  ),
}));

function favicon(domain: string) {
  return document.querySelector(`[data-slot="favicon"][data-domain="${domain}"]`);
}

describe("DomainMuteList", () => {
  it("forwards the cached favicon url to muted domain chips", async () => {
    await render(
      <DomainMuteList
        domains={[
          { id: "d1", domainName: "a.com", muted: true, faviconUrl: "https://blob.example/a.png" },
        ]}
        onMute={vi.fn<(domainId: string, muted: boolean) => void>()}
      />,
    );

    await expect.element(page.getByText("a.com", { exact: true })).toBeInTheDocument();
    expect(favicon("a.com")).toHaveAttribute("data-initial-url", "https://blob.example/a.png");
  });

  it("keeps null and undefined favicon urls distinct", async () => {
    await render(
      <DomainMuteList
        domains={[
          { id: "d1", domainName: "none.com", muted: true, faviconUrl: null },
          { id: "d2", domainName: "unknown.com", muted: true },
        ]}
        onMute={vi.fn<(domainId: string, muted: boolean) => void>()}
      />,
    );

    await expect.element(page.getByText("unknown.com", { exact: true })).toBeInTheDocument();
    expect(favicon("none.com")).toHaveAttribute("data-initial-url", "null");
    expect(favicon("unknown.com")).toHaveAttribute("data-initial-url", "undefined");
  });

  it("forwards the cached favicon url to dropdown items", async () => {
    await render(
      <DomainMuteList
        domains={[
          { id: "d1", domainName: "b.com", muted: false, faviconUrl: "https://blob.example/b.png" },
        ]}
        onMute={vi.fn<(domainId: string, muted: boolean) => void>()}
      />,
    );

    await page.getByRole("button", { name: "Mute domain" }).click();

    const item = page.getByRole("menuitem", { name: "b.com" });
    await expect.element(item).toBeInTheDocument();
    expect(item.element().querySelector('[data-slot="favicon"]')).toHaveAttribute(
      "data-initial-url",
      "https://blob.example/b.png",
    );
  });
});

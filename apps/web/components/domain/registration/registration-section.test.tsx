import { describe, expect, it, vi } from "vitest";
import { page } from "vitest/browser";

import { render } from "@/mocks/react";

import { RegistrationSection } from "./registration-section";

vi.mock("@/components/icons/favicon", () => ({
  Favicon: ({ domain }: { domain: string }) => <div data-slot="favicon" data-domain={domain} />,
}));

vi.mock("@/components/ui/tooltip", () => ({
  Tooltip: ({ children }: { children: React.ReactNode }) => (
    <div data-slot="tooltip">{children}</div>
  ),
  TooltipTrigger: ({ children }: { children: React.ReactNode }) => (
    <button type="button" data-slot="tooltip-trigger">
      {children}
    </button>
  ),
  TooltipContent: ({ children }: { children: React.ReactNode }) => (
    <div data-slot="tooltip-content">{children}</div>
  ),
}));

describe("RegistrationSection", () => {
  it("renders registrar and dates", async () => {
    await render(
      <RegistrationSection
        data={
          {
            domain: "test.invalid",
            tld: "invalid",
            isRegistered: true,
            status: "registered",
            unavailableReason: null,
            source: "rdap",
            registrarProvider: { name: "Namecheap", domain: "namecheap.com" },
            creationDate: "2020-01-01T00:00:00Z",
          } as unknown as import("@domainstack/types").RegistrationResponse
        }
      />,
    );
    // Provider name appears in multiple places (value + tooltip)
    expect(page.getByText("Namecheap", { exact: true }).length).toBeGreaterThan(0);
  });

  it("shows unavailable notice when status is unknown", async () => {
    await render(
      <RegistrationSection
        data={
          {
            domain: "example.test",
            tld: "test",
            isRegistered: false,
            status: "unknown",
            unavailableReason: "unsupported_tld",
            source: null,
            registrarProvider: { name: null, domain: null },
          } as unknown as import("@domainstack/types").RegistrationResponse
        }
      />,
    );
    await expect.element(page.getByText(/Registration Data Unavailable/i)).toBeInTheDocument();
  });

  describe("registrant row", () => {
    const base = {
      domain: "test.invalid",
      tld: "invalid",
      isRegistered: true,
      status: "registered",
      unavailableReason: null,
      source: "rdap",
      registrarProvider: { name: "Namecheap", domain: "namecheap.com" },
    };
    const renderWith = (extra: Record<string, unknown>) =>
      render(
        <RegistrationSection
          data={
            { ...base, ...extra } as unknown as import("@domainstack/types").RegistrationResponse
          }
        />,
      );

    it("shows location only instead of 'Unknown' when no name is published", async () => {
      await renderWith({ contacts: [{ type: "registrant", country: "United States of America" }] });
      await expect.element(page.getByText("United States of America").first()).toBeInTheDocument();
      expect(page.getByText(/Unknown —/).length).toBe(0);
    });

    it("shows name with location", async () => {
      await renderWith({
        contacts: [{ type: "registrant", organization: "Acme Corp", state: "CA", country: "US" }],
      });
      await expect.element(page.getByText("Acme Corp").first()).toBeInTheDocument();
      await expect.element(page.getByText(/CA, United States/).first()).toBeInTheDocument();
    });

    it("shows Not published, not Hidden, when only the country was redacted", async () => {
      await renderWith({
        contacts: [{ type: "registrant", redacted: true, redactedFields: ["country"] }],
      });
      await expect.element(page.getByText("Not published").first()).toBeInTheDocument();
    });

    it("shows Hidden when privacy is enabled and the name is a placeholder", async () => {
      await renderWith({
        privacyEnabled: true,
        contacts: [{ type: "registrant", redacted: true, redactedFields: ["name"] }],
      });
      await expect.element(page.getByText("Hidden").first()).toBeInTheDocument();
    });

    it("still shows a visible name when privacy is enabled by an email-only redaction", async () => {
      await renderWith({
        privacyEnabled: true,
        contacts: [{ type: "registrant", name: "Jane Doe", redacted: true }],
      });
      await expect.element(page.getByText("Jane Doe").first()).toBeInTheDocument();
    });

    it("shows Not published when the contact is empty", async () => {
      await renderWith({ contacts: [{ type: "registrant" }] });
      await expect.element(page.getByText("Not published").first()).toBeInTheDocument();
    });
  });
});

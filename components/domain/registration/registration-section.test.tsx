/* @vitest-environment jsdom */
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { RegistrationSection } from "./registration-section";

vi.mock("@/components/favicon", () => ({
  Favicon: ({ domain }: { domain: string }) => (
    <div data-slot="favicon" data-domain={domain} />
  ),
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
  it("renders registrar and dates", () => {
    render(
      <RegistrationSection
        data={
          {
            domain: "example.com",
            tld: "com",
            isRegistered: true,
            source: "rdap",
            registrarProvider: { name: "Namecheap", domain: "namecheap.com" },
            creationDate: "2020-01-01T00:00:00Z",
          } as unknown as import("@/lib/schemas").Registration
        }
      />,
    );
    // Use getAllByText since provider name appears in multiple places (value + tooltip)
    const namecheapElements = screen.getAllByText("Namecheap");
    expect(namecheapElements.length).toBeGreaterThan(0);
  });

  it("shows unavailable notice when source is null", () => {
    render(
      <RegistrationSection
        data={
          {
            domain: "example.test",
            tld: "test",
            isRegistered: true,
            source: null,
            registrarProvider: { name: null, domain: null },
          } as unknown as import("@/lib/schemas").Registration
        }
      />,
    );
    expect(
      screen.getByText(/Registration Data Unavailable/i),
    ).toBeInTheDocument();
  });
});

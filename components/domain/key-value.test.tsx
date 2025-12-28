import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@/lib/test-utils";
import { KeyValue } from "./key-value";

// Mock CopyButton - we're testing KeyValue, not clipboard functionality
vi.mock("@/components/copy-button", () => ({
  CopyButton: () => <button type="button">Copy</button>,
}));

vi.mock("@/components/ui/tooltip", () => ({
  Tooltip: ({ children }: { children: React.ReactNode }) => (
    <div data-slot="tooltip">{children}</div>
  ),
  TooltipTrigger: ({
    children,
    render,
  }: {
    children?: React.ReactNode;
    render?: React.ReactNode;
  }) => (
    <button type="button" data-slot="tooltip-trigger">
      {render ?? children}
    </button>
  ),
  TooltipContent: ({ children }: { children: React.ReactNode }) => (
    <div data-slot="tooltip-content">{children}</div>
  ),
}));

vi.mock("@/components/ui/responsive-tooltip", () => ({
  ResponsiveTooltip: ({ children }: { children: React.ReactNode }) => (
    <div data-slot="responsive-tooltip">{children}</div>
  ),
  ResponsiveTooltipTrigger: ({
    children,
    render,
  }: {
    children?: React.ReactNode;
    render?: React.ReactNode;
  }) => (
    <button type="button" data-slot="responsive-tooltip-trigger">
      {render ?? children}
    </button>
  ),
  ResponsiveTooltipContent: ({ children }: { children: React.ReactNode }) => (
    <div data-slot="responsive-tooltip-content">{children}</div>
  ),
}));

describe("KeyValue", () => {
  it("renders label/value and shows copy button when copyable", () => {
    render(<KeyValue label="Registrar" value="Namecheap" copyable />);
    expect(screen.getByText("Registrar")).toBeInTheDocument();
    // Value appears in both tooltip trigger and content
    expect(screen.getAllByText("Namecheap")[0]).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /copy/i })).toBeInTheDocument();
  });

  it("renders without copy button when not copyable", () => {
    render(<KeyValue label="Registrar" value="NameCheap" />);
    expect(screen.getByText("Registrar")).toBeInTheDocument();
    // Value appears in both tooltip trigger and content
    expect(screen.getAllByText("NameCheap")[0]).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /copy/i })).toBeNull();
  });
});

describe("KeyValue tooltip", () => {
  it("renders custom tooltip content when provided", async () => {
    const { KeyValue } = await import("./key-value");
    render(
      <KeyValue
        label="Valid from"
        value="Oct. 2, 2025"
        valueTooltip="2025-10-02 00:00:00 UTC"
      />,
    );
    expect(screen.getByText("Oct. 2, 2025")).toBeInTheDocument();
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: "Oct. 2, 2025" }));
    expect(
      await screen.findByText("2025-10-02 00:00:00 UTC"),
    ).toBeInTheDocument();
  });
});

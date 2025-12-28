
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@/lib/test-utils";
import { DashboardHeader } from "./dashboard-header";

// Mock next/link
vi.mock("next/link", () => ({
  default: ({
    children,
    href,
    onClick,
    ...props
  }: {
    children: React.ReactNode;
    href: string;
    onClick?: React.MouseEventHandler;
  }) => (
    <a href={href} onClick={onClick} {...props}>
      {children}
    </a>
  ),
}));

describe("DashboardHeader", () => {
  const defaultProps = {
    userName: "Test User",
    trackedCount: 0,
    maxDomains: 5,
    viewMode: "grid" as const,
    tier: "free" as const,
    subscriptionEndsAt: null,
    onViewModeChange: vi.fn(),
    onAddDomain: vi.fn(),
  };

  it("hides view mode toggle when hasAnyDomains is false", () => {
    render(<DashboardHeader {...defaultProps} hasAnyDomains={false} />);

    // View toggle buttons should not be present
    expect(
      screen.queryByRole("button", { name: "Grid view" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Table view" }),
    ).not.toBeInTheDocument();

    // Add Domain button should still be present
    expect(screen.getByText("Add Domain")).toBeInTheDocument();
  });

  it("shows view mode toggle when hasAnyDomains is true", () => {
    render(<DashboardHeader {...defaultProps} hasAnyDomains={true} />);

    // View toggle buttons should be present
    expect(
      screen.getByRole("button", { name: "Grid view" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Table view" }),
    ).toBeInTheDocument();
  });

  it("hides view mode toggle by default (backward compatibility)", () => {
    // When hasAnyDomains is not provided, it defaults to false
    render(<DashboardHeader {...defaultProps} />);

    expect(
      screen.queryByRole("button", { name: "Grid view" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Table view" }),
    ).not.toBeInTheDocument();
  });

  it("calls onViewModeChange when view toggle buttons are clicked", async () => {
    const user = userEvent.setup();
    const onViewModeChange = vi.fn();

    render(
      <DashboardHeader
        {...defaultProps}
        hasAnyDomains={true}
        onViewModeChange={onViewModeChange}
      />,
    );

    await user.click(screen.getByRole("button", { name: "Grid view" }));
    expect(onViewModeChange).toHaveBeenCalledWith("grid");

    await user.click(screen.getByRole("button", { name: "Table view" }));
    expect(onViewModeChange).toHaveBeenCalledWith("table");
  });

  it("displays user's first name in greeting", () => {
    render(
      <DashboardHeader {...defaultProps} userName="John Doe" hasAnyDomains />,
    );

    expect(screen.getByText(/Welcome back, John!/i)).toBeInTheDocument();
  });

  it("shows correct tier badge for free tier", () => {
    render(<DashboardHeader {...defaultProps} tier="free" hasAnyDomains />);

    expect(screen.getByText("Free")).toBeInTheDocument();
  });

  it("shows correct tier badge for pro tier", () => {
    render(<DashboardHeader {...defaultProps} tier="pro" hasAnyDomains />);

    expect(screen.getByText("Pro")).toBeInTheDocument();
  });

  it("displays domain count progress", () => {
    render(
      <DashboardHeader
        {...defaultProps}
        trackedCount={3}
        maxDomains={5}
        hasAnyDomains
      />,
    );

    expect(screen.getByText("3/5")).toBeInTheDocument();
  });

  it("disables Add Domain button when at limit", () => {
    render(
      <DashboardHeader
        {...defaultProps}
        trackedCount={5}
        maxDomains={5}
        hasAnyDomains
      />,
    );

    const addButton = screen.getByRole("button", { name: /Add Domain/i });
    expect(addButton).toBeDisabled();
  });

  it("enables Add Domain button when below limit", () => {
    render(
      <DashboardHeader
        {...defaultProps}
        trackedCount={3}
        maxDomains={5}
        hasAnyDomains
      />,
    );

    const addButton = screen.getByRole("button", { name: /Add Domain/i });
    expect(addButton).not.toBeDisabled();
  });
});

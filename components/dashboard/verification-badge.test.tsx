/* @vitest-environment jsdom */
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { VerificationBadge } from "./verification-badge";

describe("VerificationBadge", () => {
  describe("verified state", () => {
    it("shows Verified badge when verified is true", () => {
      render(<VerificationBadge verified={true} />);

      expect(screen.getByText("Verified")).toBeInTheDocument();
    });

    it("applies success styling for verified state", () => {
      const { container } = render(<VerificationBadge verified={true} />);

      const badge = container.querySelector('[class*="success"]');
      expect(badge).toBeInTheDocument();
    });
  });

  describe("pending state", () => {
    it("shows Pending badge when verified is false", () => {
      render(<VerificationBadge verified={false} />);

      expect(screen.getByText("Pending")).toBeInTheDocument();
    });

    it("applies amber styling for pending state", () => {
      const { container } = render(<VerificationBadge verified={false} />);

      const badge = container.querySelector('[class*="amber"]');
      expect(badge).toBeInTheDocument();
    });
  });

  describe("failing state", () => {
    it("shows Failing badge when verified but status is failing", () => {
      render(
        <VerificationBadge verified={true} verificationStatus="failing" />,
      );

      expect(screen.getByText("Failing")).toBeInTheDocument();
    });

    it("applies amber styling for failing state", () => {
      const { container } = render(
        <VerificationBadge verified={true} verificationStatus="failing" />,
      );

      const badge = container.querySelector('[class*="amber"]');
      expect(badge).toBeInTheDocument();
    });

    it("shows Verified when verified and status is verified", () => {
      render(
        <VerificationBadge verified={true} verificationStatus="verified" />,
      );

      expect(screen.getByText("Verified")).toBeInTheDocument();
    });

    it("shows Pending when not verified regardless of status", () => {
      render(
        <VerificationBadge verified={false} verificationStatus="failing" />,
      );

      expect(screen.getByText("Pending")).toBeInTheDocument();
    });
  });

  describe("custom className", () => {
    it("applies custom className", () => {
      const { container } = render(
        <VerificationBadge verified={true} className="custom-class" />,
      );

      const badge = container.firstChild;
      expect(badge).toHaveClass("custom-class");
    });
  });
});

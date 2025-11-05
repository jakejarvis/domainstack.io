/* @vitest-environment jsdom */
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

// Mock the video player components to avoid media-chrome dependencies
vi.mock("@/components/ui/video-player", () => ({
  VideoPlayer: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="video-player">{children}</div>
  ),
  VideoPlayerContent: () => <div data-testid="video-content" />,
}));

import { BookmarkletDialog } from "@/components/bookmarklet-dialog";

describe("Bookmarklet", () => {
  it("sets Inspect Domain href to a javascript: url", async () => {
    render(<BookmarkletDialog />);
    await userEvent.click(
      screen.getByRole("button", { name: /open bookmarklet info/i }),
    );
    const link = screen.getByRole("link", { name: /inspect domain/i });
    expect(link.getAttribute("href")?.startsWith("javascript:")).toBe(true);
  });
});

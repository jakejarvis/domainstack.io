import type { QueryFunction } from "@tanstack/react-query";
import { describe, expect, it, vi } from "vitest";
import { page } from "vitest/browser";

import { createTestQueryClient, render } from "@/mocks/react";

import { RemoteIcon } from "./remote-icon";

type IconResult = { success: true; data: { url: string | null } } | { success: false };

function makeQueryFn(result: IconResult = { success: true, data: { url: null } }) {
  return vi.fn<QueryFunction<IconResult, readonly string[]>>().mockResolvedValue(result);
}

describe("RemoteIcon", () => {
  it("renders a known url without running the query", async () => {
    const queryFn = makeQueryFn();

    await render(
      <RemoteIcon
        queryOptions={{ queryKey: ["icon", "known"], queryFn }}
        initialUrl="https://icon.test.invalid/i.png"
        fallbackIdentifier="example.com"
        alt="example icon"
      />,
      { queryClient: createTestQueryClient() },
    );

    await expect
      .element(page.getByRole("img", { name: "example icon" }))
      .toHaveAttribute("src", "https://icon.test.invalid/i.png");
    expect(queryFn).not.toHaveBeenCalled();
  });

  it("renders the letter fallback for a known-none url without running the query", async () => {
    const queryFn = makeQueryFn();

    await render(
      <RemoteIcon
        queryOptions={{ queryKey: ["icon", "none"], queryFn }}
        initialUrl={null}
        fallbackIdentifier="example.com"
        alt="example icon"
      />,
      { queryClient: createTestQueryClient() },
    );

    await expect.element(page.getByRole("img", { name: "example icon" })).toHaveTextContent("E");
    expect(queryFn).not.toHaveBeenCalled();
  });

  it("runs the query once when the url is unknown", async () => {
    const queryFn = makeQueryFn({ success: true, data: { url: null } });

    await render(
      <RemoteIcon
        queryOptions={{ queryKey: ["icon", "unknown"], queryFn }}
        fallbackIdentifier="example.com"
        alt="example icon"
      />,
      { queryClient: createTestQueryClient() },
    );

    await expect.element(page.getByRole("img", { name: "example icon" })).toHaveTextContent("E");
    expect(queryFn).toHaveBeenCalledTimes(1);
  });
});

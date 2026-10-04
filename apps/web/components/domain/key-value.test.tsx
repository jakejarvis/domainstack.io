import { describe, expect, it } from "vitest";
import { page } from "vitest/browser";

import { render } from "@/mocks/react";

import { KeyValue } from "./key-value";

describe("KeyValue", () => {
  it("does not repeat an untruncated value in a tooltip when hovered", async () => {
    await render(<KeyValue label="DNS" value="Cloudflare" />);
    const value = page.getByText("Cloudflare", { exact: true });
    await value.hover();
    await expect.element(value).toHaveAttribute("data-popup-open");
    expect(page.getByText("Cloudflare", { exact: true }).length).toBe(1);
  });

  it("shows valueTooltip on hover", async () => {
    await render(<KeyValue label="DNS" value="Cloudflare" valueTooltip="Anycast DNS" />);
    await page.getByText("Cloudflare", { exact: true }).hover();
    await expect.element(page.getByText("Anycast DNS", { exact: true })).toBeVisible();
  });
});

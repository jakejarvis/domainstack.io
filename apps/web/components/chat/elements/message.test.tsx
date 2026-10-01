import { describe, expect, it } from "vitest";
import { page } from "vitest/browser";

import { render } from "@/mocks/react";

import { MessageResponse } from "./message";

const MEDIA_SELECTOR = "img, picture, source, video, audio, iframe, object, embed";

describe("MessageResponse", () => {
  it.each([
    ["a markdown image", "![x](https://example.com/a.png)"],
    ["a raw img tag", '<img src="https://example.com/a.png">'],
    ["a data: image", "![x](data:image/png;base64,iVBORw0KGgo=)"],
    ["a raw picture tag", '<picture><source srcset="https://example.com/a.webp"></picture>'],
  ])("renders no media element for %s", async (_name, source) => {
    // The trailing paragraph proves rendering finished before asserting absence.
    await render(<MessageResponse>{`${source}\n\nrendered-marker`}</MessageResponse>);

    await expect.element(page.getByText("rendered-marker")).toBeVisible();
    expect(document.querySelectorAll(MEDIA_SELECTOR)).toHaveLength(0);
  });

  it("still renders emphasis and links", async () => {
    await render(<MessageResponse>**bold** and [a link](https://example.com)</MessageResponse>);

    await expect.element(page.getByText("a link")).toBeVisible();
    // Streamdown renders bold as a styled element tagged with data-streamdown="strong".
    expect(document.querySelectorAll('[data-streamdown="strong"]')).toHaveLength(1);
  });

  it("still renders code blocks", async () => {
    await render(<MessageResponse>{"```js\nconst a = 1\n```"}</MessageResponse>);

    await expect.poll(() => document.querySelectorAll("pre").length).toBeGreaterThan(0);
  });
});

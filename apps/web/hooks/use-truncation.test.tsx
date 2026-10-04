import { describe, expect, it } from "vitest";
import { page } from "vitest/browser";

import { render } from "@/mocks/react";

import { useTruncation } from "./use-truncation";

// Wraps the measured span once truncated, the way ProviderCell does, so React
// mounts a new element behind the same ref.
function Harness() {
  const { valueRef, isTruncated } = useTruncation();
  const value = (
    <span ref={valueRef} className="block truncate">
      a fairly long provider name
    </span>
  );
  return (
    <div style={{ width: 40 }} data-truncated={String(isTruncated)} data-testid="harness">
      {isTruncated ? <div>{value}</div> : value}
    </div>
  );
}

describe("useTruncation", () => {
  it("keeps tracking the value after the caller swaps its element", async () => {
    await render(<Harness />);
    const harness = page.getByTestId("harness");
    await expect.element(harness).toHaveAttribute("data-truncated", "true");

    // Resize outside React so only the hook's observers can notice.
    harness.element().setAttribute("style", "width: 600px");
    await expect.element(harness).toHaveAttribute("data-truncated", "false");
  });
});

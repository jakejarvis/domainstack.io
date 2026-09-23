import { describe, expect, it } from "vitest";
import { page } from "vitest/browser";

import { useSectionTracking } from "@/hooks/use-section-tracking";
import { render } from "@/mocks/react";

const IDS = ["one", "two", "three"];

function Harness() {
  const { activeSection } = useSectionTracking(IDS);
  return (
    <>
      <output aria-label="active">{activeSection}</output>
      {IDS.map((id) => (
        <section key={id} id={id} style={{ height: 1000, scrollMarginTop: 120 }} />
      ))}
    </>
  );
}

describe("useSectionTracking", () => {
  it("activates a section once its top reaches its CSS scroll-margin-top", async () => {
    await render(<Harness />);
    const two = document.getElementById("two");
    if (!two) throw new Error("missing section");
    const twoTop = two.getBoundingClientRect().top + window.scrollY;

    window.scrollTo(0, twoTop - 130);
    await expect.element(page.getByLabelText("active")).toHaveTextContent("one");

    window.scrollTo(0, twoTop - 120);
    await expect.element(page.getByLabelText("active")).toHaveTextContent("two");
    window.scrollTo(0, 0);
  });
});

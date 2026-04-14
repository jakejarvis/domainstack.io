import { describe, expect, it } from "vitest";

import { getImageProps } from "./next-image";

describe("next/image mock", () => {
  it("returns image props from direct getImageProps options", () => {
    const { props } = getImageProps({
      src: "/api/avatar/user-1",
      alt: "User avatar",
      width: 32,
      height: 32,
      priority: true,
      unoptimized: true,
    });

    expect(props).toEqual({
      src: "/api/avatar/user-1",
      alt: "User avatar",
      width: 32,
      height: 32,
    });
  });
});

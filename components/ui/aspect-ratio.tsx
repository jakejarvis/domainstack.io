"use client";

import type * as React from "react";

function AspectRatio({
  ratio = 1,
  style,
  ...props
}: React.ComponentPropsWithoutRef<"div"> & { ratio?: number }) {
  return (
    <div
      data-slot="aspect-ratio"
      style={{ aspectRatio: `${ratio}`, ...style }}
      {...props}
    />
  );
}

export { AspectRatio };

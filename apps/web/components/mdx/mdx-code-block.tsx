import { isValidElement } from "react";

import { CodeBlock } from "@domainstack/ui/code-block";

/** Renders MDX fenced code (`<pre><code>…</code></pre>`) as a copyable `CodeBlock`. */
export function MdxCodeBlock({ children }: React.ComponentProps<"pre">) {
  const code = isValidElement<{ children?: React.ReactNode }>(children)
    ? children.props.children
    : children;

  return <CodeBlock>{typeof code === "string" ? code.replace(/\n$/, "") : code}</CodeBlock>;
}

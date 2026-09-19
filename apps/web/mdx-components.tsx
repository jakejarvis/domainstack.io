import type { MDXComponents } from "mdx/types";

import { MdxCodeBlock } from "@/components/mdx/mdx-code-block";
import { MdxLink } from "@/components/mdx/mdx-link";
import { PageHeader } from "@/components/mdx/page-header";
import { CodeBlock } from "@domainstack/ui/code-block";

export function useMDXComponents(): MDXComponents {
  return {
    a: MdxLink,
    pre: MdxCodeBlock,
    CodeBlock,
    PageHeader,
  };
}

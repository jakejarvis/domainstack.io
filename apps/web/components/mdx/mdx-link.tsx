import { IconExternalLink } from "@tabler/icons-react";
import Link from "next/link";

const EXTERNAL_HREF = /^https?:\/\//i;

/**
 * Link renderer for MDX content: `http(s)` links open in a new tab with an
 * external-link icon, root-relative paths use `next/link`, everything else
 * (`mailto:`, `#fragment`, custom schemes) is a plain anchor.
 */
export function MdxLink({ href = "", children, ...props }: React.ComponentProps<"a">) {
  if (EXTERNAL_HREF.test(href)) {
    return (
      <a href={href} target="_blank" rel="noopener noreferrer" {...props}>
        {children}
        <IconExternalLink className="mr-0.5 ml-1 inline-block size-3.5 -translate-y-0.5 text-foreground/70" />
      </a>
    );
  }

  if (href.startsWith("/") && !href.startsWith("//")) {
    return (
      <Link href={href} {...props}>
        {children}
      </Link>
    );
  }

  return (
    <a href={href} {...props}>
      {children}
    </a>
  );
}

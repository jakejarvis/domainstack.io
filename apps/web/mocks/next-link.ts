import { createElement } from "react";

type NextLinkMockProps = {
  href: string | { pathname?: string };
  children?: React.ReactNode;
  prefetch?: unknown;
  scroll?: unknown;
  replace?: unknown;
  shallow?: unknown;
  locale?: unknown;
  passHref?: unknown;
  onNavigate?: (e: { preventDefault: () => void }) => void;
} & Omit<React.ComponentProps<"a">, "href">;

/**
 * Tests never navigate, so a Link is only pending when a test says so: set
 * `linkStatusMock.pending` before rendering (and reset it afterwards).
 */
export const linkStatusMock = { pending: false };

export function useLinkStatus() {
  return { pending: linkStatusMock.pending };
}

export default function NextLinkMock({
  href,
  children,
  prefetch: _prefetch,
  scroll: _scroll,
  replace: _replace,
  shallow: _shallow,
  locale: _locale,
  passHref: _passHref,
  onClick,
  onNavigate,
  ...props
}: NextLinkMockProps) {
  const resolvedHref = typeof href === "string" ? href : (href.pathname ?? "#");
  return createElement(
    "a",
    {
      href: resolvedHref,
      ...props,
      // Like next/link: run the caller's handler, then report a client-side navigation
      // for unmodified left clicks only. Either way, never navigate the test page.
      onClick: (e: React.MouseEvent<HTMLAnchorElement>) => {
        onClick?.(e);
        const isModified = e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0;
        if (!e.defaultPrevented && !isModified) {
          onNavigate?.({ preventDefault: () => {} });
        }
        e.preventDefault();
      },
    },
    children,
  );
}

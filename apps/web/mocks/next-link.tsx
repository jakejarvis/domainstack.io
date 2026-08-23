import { type ComponentProps, createElement, type ReactNode } from "react";

type NextLinkMockProps = {
  href: string | { pathname?: string };
  children?: ReactNode;
  prefetch?: unknown;
  scroll?: unknown;
  replace?: unknown;
  shallow?: unknown;
  locale?: unknown;
  passHref?: unknown;
} & Omit<ComponentProps<"a">, "href">;

export default function NextLinkMock({
  href,
  children,
  prefetch: _prefetch,
  scroll: _scroll,
  replace: _replace,
  shallow: _shallow,
  locale: _locale,
  passHref: _passHref,
  ...props
}: NextLinkMockProps) {
  const resolvedHref = typeof href === "string" ? href : (href.pathname ?? "#");
  return createElement("a", { href: resolvedHref, ...props }, children);
}

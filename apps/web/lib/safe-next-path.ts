/**
 * Accept only a same-origin, path-absolute redirect target from user input.
 * Returns the normalized path (+ query + hash) or null.
 */
export function safeNextPath(value: string | null | undefined): string | null {
  if (!value || !value.startsWith("/") || value.startsWith("//") || value.startsWith("/\\")) {
    return null;
  }
  let url: URL;
  try {
    url = new URL(value, "https://placeholder.invalid");
  } catch {
    return null;
  }
  if (url.origin !== "https://placeholder.invalid") return null;
  // Never bounce back into the login page or into API routes.
  if (
    url.pathname === "/login" ||
    url.pathname.startsWith("/login/") ||
    url.pathname.startsWith("/api/")
  ) {
    return null;
  }
  const path = url.pathname + url.search + url.hash;
  // Checked after parsing: dot-segments like `/.//host` normalize to `//host`,
  // which a browser would treat as a protocol-relative (cross-origin) URL.
  if (path.startsWith("//") || path.startsWith("/\\")) return null;
  return path;
}

/** `/login?next=…` for a same-origin path, or plain `/login` when the path is unusable. */
export function loginHref(next: string | null | undefined): string {
  const safe = safeNextPath(next);
  return safe && safe !== "/" ? `/login?next=${encodeURIComponent(safe)}` : "/login";
}

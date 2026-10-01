/**
 * `request.path` from Next's onRequestError includes the query string, which can hold
 * credentials (the calendar feed's `?token=`). Keep the pathname and the parameter
 * names only.
 */
export function redactRequestPath(path: string): string {
  const url = new URL(path, "http://placeholder.invalid");
  const names = [...new Set(url.searchParams.keys())];
  return names.length > 0
    ? `${url.pathname}?${names.map((n) => `${n}=…`).join("&")}`
    : url.pathname;
}

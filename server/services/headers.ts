import { captureServer } from "@/lib/analytics/server";
import { ns, redis } from "@/lib/redis";
import type { HttpHeader } from "@/lib/schemas";

export async function probeHeaders(domain: string): Promise<HttpHeader[]> {
  const startedAt = Date.now();
  const lower = domain.toLowerCase();
  const url = `https://${domain}/`;
  const key = ns("headers", lower);

  console.debug("[headers] start", { domain: lower });
  const cached = await redis.get<HttpHeader[]>(key);
  if (cached) {
    console.info("[headers] cache hit", {
      domain: lower,
      count: cached.length,
    });
    return cached;
  }

  const REQUEST_TIMEOUT_MS = 5000;
  try {
    // Try HEAD first with timeout
    const headController = new AbortController();
    const headTimer = setTimeout(
      () => headController.abort(),
      REQUEST_TIMEOUT_MS,
    );
    let res: Response | null = null;
    try {
      res = await fetch(url, {
        method: "HEAD",
        redirect: "follow" as RequestRedirect,
        signal: headController.signal,
      });
    } finally {
      clearTimeout(headTimer);
    }

    let final: Response | null = res;
    if (!res || !res.ok) {
      const getController = new AbortController();
      const getTimer = setTimeout(
        () => getController.abort(),
        REQUEST_TIMEOUT_MS,
      );
      try {
        final = await fetch(url, {
          method: "GET",
          redirect: "follow" as RequestRedirect,
          signal: getController.signal,
        });
      } finally {
        clearTimeout(getTimer);
      }
    }

    if (!final) throw new Error("No response");

    const headers: HttpHeader[] = [];
    final.headers.forEach((value, name) => {
      headers.push({ name, value });
    });
    const normalized = normalize(headers);

    await captureServer("headers_result", {
      domain: lower,
      status: final.status,
      used_method: res?.ok ? "HEAD" : "GET",
      duration_ms: Date.now() - startedAt,
      outcome: final.ok ? "ok" : "error",
    });

    await redis.set(key, normalized, { ex: 10 * 60 });
    console.info("[headers] ok", {
      domain: lower,
      status: final.status,
      count: normalized.length,
    });
    return normalized;
  } catch (err) {
    console.warn("[headers] error", {
      domain: lower,
      error: (err as Error)?.message,
    });
    await captureServer("headers_result", {
      domain: lower,
      status: -1,
      used_method: "ERROR",
      duration_ms: Date.now() - startedAt,
      outcome: "error",
      error: String(err),
    });
    // Return empty on failure without caching to avoid long-lived negatives
    return [];
  }
}

function normalize(h: HttpHeader[]): HttpHeader[] {
  // sort important first
  const important = new Set([
    "strict-transport-security",
    "content-security-policy",
    "content-security-policy-report-only",
    "x-frame-options",
    "referrer-policy",
    "server",
    "x-powered-by",
    "cache-control",
    "permissions-policy",
  ]);
  return [...h].sort(
    (a, b) =>
      Number(important.has(b.name)) - Number(important.has(a.name)) ||
      a.name.localeCompare(b.name),
  );
}

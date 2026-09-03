import { ipAddress } from "@vercel/functions";

import { createLogger } from "@domainstack/logger";

const logger = createLogger({ source: "trpc/context" });

export type Session = {
  user: { id: string; name: string; email: string };
};

export type Context = {
  req: Request | undefined;
  ip: string | null;
  session: Session | null;
};

export type CreateContextOptions = {
  req?: Request;
  /** Caller provides headers (from req or next/headers) */
  headers?: Headers;
};

/**
 * Resolve the client IP from a Request (Vercel `ipAddress`) or forwarded headers.
 * RSC prefetch has headers but no Request; API routes have both.
 */
export function resolveClientIp(req?: Request, headers?: Headers): string | null {
  if (req) {
    const fromRequest = ipAddress(req);
    if (fromRequest) {
      return fromRequest;
    }
  }

  const hdrs = req?.headers ?? headers;
  if (!hdrs) {
    return null;
  }

  const forwarded = hdrs.get("x-forwarded-for");
  if (forwarded) {
    const first = forwarded.split(",")[0]?.trim();
    if (first) {
      return first;
    }
  }

  return hdrs.get("x-real-ip") ?? hdrs.get("x-vercel-forwarded-for") ?? null;
}

/**
 * Creates tRPC context with session and IP information.
 *
 * The context accepts headers as a parameter, making it portable
 * (not coupled to Next.js `headers()`). The web app wrapper provides
 * headers from either the request or `headers()`.
 */
export async function createContext(opts: CreateContextOptions = {}): Promise<Context> {
  const { req, headers } = opts;
  const ip = resolveClientIp(req, headers);

  // Use request headers if available, otherwise use provided headers
  const hdrs = req?.headers ?? headers;

  let session: Session | null = null;
  if (hdrs) {
    try {
      const { auth } = await import("@domainstack/auth/server");
      const authSession = await auth.api.getSession({ headers: hdrs });
      if (authSession?.user) {
        session = {
          user: {
            id: authSession.user.id,
            name: authSession.user.name,
            email: authSession.user.email,
          },
        };
      }
    } catch (error) {
      // Log auth errors but don't crash - session remains null
      // This can happen if auth is misconfigured or database is unavailable
      logger.error({ err: error }, "auth session lookup failed");
    }
  }

  return { req, ip, session };
}

import { ipAddress } from "@vercel/functions";

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
 * Creates tRPC context with session and IP information.
 *
 * The context accepts headers as a parameter, making it portable
 * (not coupled to Next.js `headers()`). The web app wrapper provides
 * headers from either the request or `headers()`.
 */
export async function createContext(
  opts: CreateContextOptions = {},
): Promise<Context> {
  const { req } = opts;
  const ip = req ? (ipAddress(req) ?? null) : null;

  // Use request headers if available, otherwise use provided headers
  const hdrs = req?.headers ?? opts.headers;

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
      console.error("[tRPC context] Auth error:", error);
    }
  }

  return { req, ip, session };
}

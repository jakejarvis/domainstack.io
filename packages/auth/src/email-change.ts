/**
 * Better Auth 1.7.7's change-email link carries a signed JWT whose payload is
 * `{ email: <current>, updateTo: <new>, requestType: "change-email-verification" }`.
 * These helpers only *read* that payload. Better Auth checks the signature in
 * /verify-email, so never use them on their own to authorize anything.
 */
const CHANGE_EMAIL_VERIFICATION = "change-email-verification";

export type EmailChange = { previousEmail: string; newEmail: string };

/** The addresses in a change-email-verification token, or null for any other token or input. */
export function readEmailChangeToken(token: unknown): EmailChange | null {
  if (typeof token !== "string") return null;
  const parts = token.split(".");
  const payloadPart = parts[1];
  if (parts.length !== 3 || !payloadPart) return null;
  let payload: unknown;
  try {
    payload = JSON.parse(Buffer.from(payloadPart, "base64url").toString("utf8"));
  } catch {
    return null;
  }
  if (typeof payload !== "object" || payload === null) return null;
  const { email, updateTo, requestType } = payload as Record<string, unknown>;
  if (
    requestType !== CHANGE_EMAIL_VERIFICATION ||
    typeof email !== "string" ||
    typeof updateTo !== "string"
  ) {
    return null;
  }
  return { previousEmail: email.toLowerCase(), newEmail: updateTo.toLowerCase() };
}

type EndpointLike = { path?: string; query?: unknown };

function tokenFrom(query: unknown): unknown {
  return typeof query === "object" && query !== null && "token" in query
    ? (query as { token?: unknown }).token
    : undefined;
}

/** True when this request is someone opening a change-email link. */
export function isEmailChangeVerification(ctx: EndpointLike): boolean {
  return ctx.path === "/verify-email" && readEmailChangeToken(tokenFrom(ctx.query)) !== null;
}

/**
 * In a `user.update.after` hook: the address the user just moved away from, when
 * this update is the one /verify-email made for a change-email link. Null for
 * every other update (sign-in flips of emailVerified, Polar, …).
 */
export function previousEmailForUpdate(
  user: { email: string } | null | undefined,
  ctx: EndpointLike | null,
): string | null {
  // The adapter hands the hook `undefined` when the UPDATE matched no row (e.g.
  // the second of two racing clicks on one link).
  if (!user || !ctx || ctx.path !== "/verify-email") return null;
  const change = readEmailChangeToken(tokenFrom(ctx.query));
  if (!change || change.newEmail !== user.email.toLowerCase()) return null;
  return change.previousEmail;
}

/** Better Auth client calls resolve `{ error }` instead of throwing. */
export type AuthClientError = { status?: number; message?: string } | null | undefined;

/** Toast description for a failed auth client call. */
export function authErrorDescription(error: NonNullable<AuthClientError>): string {
  return error.status === 429
    ? "Too many attempts. Wait a few seconds and try again."
    : "Please try again.";
}

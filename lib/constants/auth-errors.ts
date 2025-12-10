/**
 * Auth callback error codes returned by better-auth.
 * These are appended to the callback URL as ?error=<code> when OAuth flows fail.
 *
 * @see https://www.better-auth.com/docs/concepts/oauth
 */

/**
 * Error codes that better-auth returns in the callback URL query params.
 * These are the values of the `error` query parameter.
 */
export const AUTH_CALLBACK_ERROR_CODES = {
  // Account linking errors
  EMAIL_DOESNT_MATCH: "email_doesn't_match",
  ACCOUNT_ALREADY_LINKED: "account_already_linked_to_different_user",
  UNABLE_TO_LINK: "unable_to_link_account",

  // OAuth flow errors
  STATE_MISMATCH: "state_mismatch",
  PLEASE_RESTART: "please_restart_the_process",
  INVALID_CALLBACK: "invalid_callback_request",
  INTERNAL_ERROR: "internal_server_error",
  NO_CODE: "no_code",
  INVALID_CODE: "invalid_code",
  PROVIDER_NOT_FOUND: "oauth_provider_not_found",
  UNABLE_TO_GET_USER_INFO: "unable_to_get_user_info",
  NO_CALLBACK_URL: "no_callback_url",
  EMAIL_NOT_FOUND: "email_not_found",
} as const;

export type AuthCallbackErrorCode =
  (typeof AUTH_CALLBACK_ERROR_CODES)[keyof typeof AUTH_CALLBACK_ERROR_CODES];

/**
 * User-friendly error messages for auth callback errors.
 * Maps error codes to messages that can be displayed in the UI.
 */
export const AUTH_CALLBACK_ERROR_MESSAGES: Record<
  AuthCallbackErrorCode,
  string
> = {
  // Account linking errors - most common for users
  [AUTH_CALLBACK_ERROR_CODES.EMAIL_DOESNT_MATCH]:
    "The account you tried to link uses a different email address. Both accounts must use the same email.",
  [AUTH_CALLBACK_ERROR_CODES.ACCOUNT_ALREADY_LINKED]:
    "This account is already linked to a different user.",
  [AUTH_CALLBACK_ERROR_CODES.UNABLE_TO_LINK]:
    "Unable to link account. Please try again.",

  // OAuth flow errors - less common but should be handled
  [AUTH_CALLBACK_ERROR_CODES.STATE_MISMATCH]:
    "Authentication session expired. Please try again.",
  [AUTH_CALLBACK_ERROR_CODES.PLEASE_RESTART]:
    "Authentication session expired. Please try again.",
  [AUTH_CALLBACK_ERROR_CODES.INVALID_CALLBACK]:
    "Invalid authentication request. Please try again.",
  [AUTH_CALLBACK_ERROR_CODES.INTERNAL_ERROR]:
    "An internal error occurred. Please try again later.",
  [AUTH_CALLBACK_ERROR_CODES.NO_CODE]:
    "Authentication was not completed. Please try again.",
  [AUTH_CALLBACK_ERROR_CODES.INVALID_CODE]:
    "Authentication code was invalid. Please try again.",
  [AUTH_CALLBACK_ERROR_CODES.PROVIDER_NOT_FOUND]:
    "This login provider is not available.",
  [AUTH_CALLBACK_ERROR_CODES.UNABLE_TO_GET_USER_INFO]:
    "Unable to retrieve account information from the provider. Please try again.",
  [AUTH_CALLBACK_ERROR_CODES.NO_CALLBACK_URL]:
    "Authentication configuration error. Please contact support.",
  [AUTH_CALLBACK_ERROR_CODES.EMAIL_NOT_FOUND]:
    "The provider did not return an email address. Please ensure your account has a verified email.",
};

/**
 * Get a user-friendly error message for an auth callback error code.
 * Returns a generic message for unknown error codes.
 */
export function getAuthErrorMessage(errorCode: string): string {
  return (
    AUTH_CALLBACK_ERROR_MESSAGES[errorCode as AuthCallbackErrorCode] ??
    "An error occurred during authentication. Please try again."
  );
}

/**
 * Check if an error code is an account linking error (vs general OAuth error).
 * Useful for providing more contextual error messages.
 */
export function isAccountLinkingError(errorCode: string): boolean {
  return (
    errorCode === AUTH_CALLBACK_ERROR_CODES.EMAIL_DOESNT_MATCH ||
    errorCode === AUTH_CALLBACK_ERROR_CODES.ACCOUNT_ALREADY_LINKED ||
    errorCode === AUTH_CALLBACK_ERROR_CODES.UNABLE_TO_LINK
  );
}

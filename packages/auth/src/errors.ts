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
const AUTH_CALLBACK_ERROR_CODES = {
  // Account linking errors
  EMAIL_DOESNT_MATCH: "email_does_not_match",
  ACCOUNT_ALREADY_LINKED: "account_already_linked_to_different_user",
  UNABLE_TO_LINK: "unable_to_link_account",
  ACCOUNT_NOT_LINKED: "account_not_linked",

  // OAuth flow errors
  ACCESS_DENIED: "access_denied",
  STATE_NOT_FOUND: "state_not_found",
  STATE_INVALID: "state_invalid",
  STATE_MISMATCH: "state_mismatch",
  INVALID_CALLBACK: "invalid_callback_request",
  INTERNAL_ERROR: "internal_server_error",
  NO_CODE: "no_code",
  INVALID_CODE: "invalid_code",
  PROVIDER_NOT_FOUND: "oauth_provider_not_found",
  UNABLE_TO_GET_USER_INFO: "unable_to_get_user_info",
  NO_CALLBACK_URL: "no_callback_url",
  EMAIL_NOT_FOUND: "email_not_found",
  EMAIL_NOT_VERIFIED: "email_not_verified",
  SIGNUP_DISABLED: "signup_disabled",
  UNABLE_TO_CREATE_USER: "unable_to_create_user",
  UNABLE_TO_CREATE_SESSION: "unable_to_create_session",
  EMAIL_CHANGE_SIGN_IN_REQUIRED: "email_change_sign_in_required",
} as const;

export type AuthCallbackErrorCode =
  (typeof AUTH_CALLBACK_ERROR_CODES)[keyof typeof AUTH_CALLBACK_ERROR_CODES];

/**
 * User-friendly error messages for auth callback errors.
 * Maps error codes to messages that can be displayed in the UI.
 */
const AUTH_CALLBACK_ERROR_MESSAGES: Record<AuthCallbackErrorCode, string> = {
  // Account linking errors - most common for users
  [AUTH_CALLBACK_ERROR_CODES.EMAIL_DOESNT_MATCH]:
    "The account you tried to link uses a different email address. Both accounts must use the same email.",
  [AUTH_CALLBACK_ERROR_CODES.ACCOUNT_ALREADY_LINKED]:
    "This account is already linked to a different user.",
  [AUTH_CALLBACK_ERROR_CODES.UNABLE_TO_LINK]: "Unable to link account. Please try again.",
  [AUTH_CALLBACK_ERROR_CODES.ACCOUNT_NOT_LINKED]:
    "An account with this email already exists. Sign in with the provider you used before, then link this one from Settings → Account.",

  // OAuth flow errors - less common but should be handled
  [AUTH_CALLBACK_ERROR_CODES.ACCESS_DENIED]: "Authorization was cancelled. Please try again.",
  [AUTH_CALLBACK_ERROR_CODES.STATE_NOT_FOUND]: "Authentication session expired. Please try again.",
  [AUTH_CALLBACK_ERROR_CODES.STATE_INVALID]: "Authentication session expired. Please try again.",
  [AUTH_CALLBACK_ERROR_CODES.STATE_MISMATCH]: "Authentication session expired. Please try again.",
  [AUTH_CALLBACK_ERROR_CODES.INVALID_CALLBACK]: "Invalid authentication request. Please try again.",
  [AUTH_CALLBACK_ERROR_CODES.INTERNAL_ERROR]: "An internal error occurred. Please try again later.",
  [AUTH_CALLBACK_ERROR_CODES.NO_CODE]: "Authentication was not completed. Please try again.",
  [AUTH_CALLBACK_ERROR_CODES.INVALID_CODE]: "Authentication code was invalid. Please try again.",
  [AUTH_CALLBACK_ERROR_CODES.PROVIDER_NOT_FOUND]: "This login provider is not available.",
  [AUTH_CALLBACK_ERROR_CODES.UNABLE_TO_GET_USER_INFO]:
    "Unable to retrieve account information from the provider. Please try again.",
  [AUTH_CALLBACK_ERROR_CODES.NO_CALLBACK_URL]:
    "Authentication configuration error. Please contact support.",
  [AUTH_CALLBACK_ERROR_CODES.EMAIL_NOT_FOUND]:
    "The provider did not return an email address. Please ensure your account has a verified email.",
  [AUTH_CALLBACK_ERROR_CODES.EMAIL_NOT_VERIFIED]:
    "Your email address with this provider isn't verified. Verify it there, then try again.",
  [AUTH_CALLBACK_ERROR_CODES.SIGNUP_DISABLED]: "New sign-ups are currently disabled.",
  [AUTH_CALLBACK_ERROR_CODES.UNABLE_TO_CREATE_USER]:
    "Unable to create your account. Please try again later.",
  [AUTH_CALLBACK_ERROR_CODES.UNABLE_TO_CREATE_SESSION]: "Unable to sign you in. Please try again.",
  [AUTH_CALLBACK_ERROR_CODES.EMAIL_CHANGE_SIGN_IN_REQUIRED]:
    "For your security, email change links only work where you're signed in. Sign in, then open the link again.",
};

/** True for codes this app has a message for. Anything else is untrusted URL input. */
export function isKnownAuthErrorCode(code: string): code is AuthCallbackErrorCode {
  return Object.hasOwn(AUTH_CALLBACK_ERROR_MESSAGES, code);
}

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
